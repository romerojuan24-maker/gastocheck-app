import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// Interfaces for type safety
interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface TimeWindow {
  start_hour: number; // 0-23
  end_hour: number; // 0-23
}

interface Client extends GeoPoint {
  id: string;
  name?: string;
  priority?: number; // 1 (high) to 5 (low), default 3
  time_window?: TimeWindow;
  service_duration_minutes?: number; // Time to service client, default 10
}

interface RouteOptimizationInput {
  clients: Client[];
  start_point: GeoPoint;
  speed_kmh?: number; // Average speed, default 40
  current_hour?: number; // Current hour for time window filtering (0-23)
}

interface OptimizedRoute {
  optimized_order: Array<{
    client_id: string;
    position: number;
    estimated_arrival_hour: number;
    estimated_departure_hour: number;
  }>;
  total_distance_km: number;
  estimated_duration_hours: number;
  total_service_minutes: number;
  sequence: string[]; // Array of client IDs in optimal order
}

// Haversine formula: calculate distance between two points in km
function calculateDistance(
  point1: GeoPoint,
  point2: GeoPoint
): number {
  const R = 6371; // Earth radius in km
  const lat1Rad = (point1.latitude * Math.PI) / 180;
  const lat2Rad = (point2.latitude * Math.PI) / 180;
  const deltaLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const deltaLng = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Check if arrival time is within client's time window
function isWithinTimeWindow(
  arrivalHour: number,
  timeWindow?: TimeWindow
): boolean {
  if (!timeWindow) return true;
  return arrivalHour >= timeWindow.start_hour && arrivalHour < timeWindow.end_hour;
}

// Nearest-neighbor greedy algorithm: O(n²)
// Starts from start_point and greedily picks the nearest unvisited client
// Respects time windows and priorities
function nearestNeighborTSP(
  clients: Client[],
  startPoint: GeoPoint,
  speedKmh: number,
  currentHour: number
): {
  order: Client[];
  distance: number;
  duration: number;
  serviceDuration: number;
} {
  const unvisited = [...clients];
  const visited: Client[] = [];
  let currentLocation = startPoint;
  let totalDistance = 0;
  let totalDuration = 0; // in minutes
  let totalServiceMinutes = 0;
  let currentTimeHour = currentHour;

  // Filter clients that can be visited within time windows
  const visitableClients = unvisited.filter((client) => {
    const distToClient = calculateDistance(currentLocation, client);
    const timeToReachHours = distToClient / speedKmh;
    const arrivalHour = currentTimeHour + timeToReachHours;
    return isWithinTimeWindow(arrivalHour, client.time_window);
  });

  while (unvisited.length > 0) {
    let nearest: Client | null = null;
    let nearestDistance = Infinity;
    let nearestIndex = -1;

    // Find nearest unvisited client with highest priority (lowest priority number)
    for (let i = 0; i < unvisited.length; i++) {
      const client = unvisited[i];
      const distance = calculateDistance(currentLocation, client);

      // Check if client is visitable within time window
      const timeToReachHours = distance / speedKmh;
      const arrivalHour = currentTimeHour + timeToReachHours;
      const isVisitable = isWithinTimeWindow(arrivalHour, client.time_window);

      if (!isVisitable) continue;

      // Prefer closer clients, but prioritize by priority level
      const priorityWeight = (client.priority || 3) * 10; // Multiply to balance with distance
      const score = distance + priorityWeight;

      if (score < nearestDistance) {
        nearest = client;
        nearestDistance = score;
        nearestIndex = i;
      }
    }

    // If no visitable client found, pick nearest regardless of time window
    if (nearest === null && unvisited.length > 0) {
      for (let i = 0; i < unvisited.length; i++) {
        const client = unvisited[i];
        const distance = calculateDistance(currentLocation, client);
        const priorityWeight = (client.priority || 3) * 10;
        const score = distance + priorityWeight;

        if (score < nearestDistance) {
          nearest = client;
          nearestDistance = score;
          nearestIndex = i;
        }
      }
    }

    if (nearest === null) break; // Safety check, shouldn't happen

    // Add nearest client to visited
    visited.push(nearest);
    const distanceToNearest = calculateDistance(currentLocation, nearest);
    const durationToNearest = (distanceToNearest / speedKmh) * 60; // Convert to minutes
    const serviceDuration = nearest.service_duration_minutes || 10;

    totalDistance += distanceToNearest;
    totalDuration += durationToNearest + serviceDuration;
    totalServiceMinutes += serviceDuration;
    currentTimeHour += (durationToNearest + serviceDuration) / 60;
    currentLocation = nearest;

    // Remove from unvisited
    unvisited.splice(nearestIndex, 1);
  }

  return {
    order: visited,
    distance: totalDistance,
    duration: totalDuration / 60, // Convert to hours
    serviceDuration: totalServiceMinutes,
  };
}

// 2-opt local search optimization: improve solution by swapping edges
// Only run for small routes (n < 20) to avoid timeout
function twoOptOptimization(
  order: Client[],
  startPoint: GeoPoint,
  speedKmh: number,
  maxIterations: number = 100
): Client[] {
  if (order.length < 4) return order; // Not worth optimizing small routes

  let bestRoute = [...order];
  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < bestRoute.length - 2; i++) {
      for (let j = i + 2; j < bestRoute.length; j++) {
        // Calculate distances for current route and swapped route
        const currentDistance =
          calculateDistance(bestRoute[i - 1], bestRoute[i]) +
          calculateDistance(bestRoute[j], bestRoute[j + 1] || startPoint);

        const swappedDistance =
          calculateDistance(bestRoute[i - 1], bestRoute[j]) +
          calculateDistance(bestRoute[i], bestRoute[j + 1] || startPoint);

        if (swappedDistance < currentDistance) {
          // Reverse segment [i, j]
          bestRoute = [
            ...bestRoute.slice(0, i),
            ...bestRoute.slice(i, j + 1).reverse(),
            ...bestRoute.slice(j + 1),
          ];
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return bestRoute;
}

// Main optimization function
function optimizeRoute(
  clients: Client[],
  startPoint: GeoPoint,
  speedKmh: number = 40,
  currentHour: number = 8
): OptimizedRoute {
  if (!clients || clients.length === 0) {
    return {
      optimized_order: [],
      total_distance_km: 0,
      estimated_duration_hours: 0,
      total_service_minutes: 0,
      sequence: [],
    };
  }

  // Run nearest-neighbor algorithm
  const { order, distance, duration, serviceDuration } = nearestNeighborTSP(
    clients,
    startPoint,
    speedKmh,
    currentHour
  );

  // Apply 2-opt optimization for routes with 4-20 stops
  let optimizedOrder = order;
  if (order.length >= 4 && order.length <= 20) {
    optimizedOrder = twoOptOptimization(order, startPoint, speedKmh);
  }

  // Recalculate metrics with optimized order
  let totalDistance = 0;
  let totalDurationMinutes = 0;
  let currentLocation = startPoint;
  let currentTime = currentHour;

  const routeDetails = optimizedOrder.map((client, index) => {
    const distToClient = calculateDistance(currentLocation, client);
    const timeToReachHours = distToClient / speedKmh;
    const timeToReachMinutes = timeToReachHours * 60;
    const serviceDuration = client.service_duration_minutes || 10;

    const arrivalHour = currentTime + timeToReachHours;
    const departureHour = arrivalHour + serviceDuration / 60;

    totalDistance += distToClient;
    totalDurationMinutes += timeToReachMinutes + serviceDuration;
    currentLocation = client;
    currentTime = departureHour;

    return {
      client_id: client.id,
      position: index + 1,
      estimated_arrival_hour: Math.floor(arrivalHour * 100) / 100,
      estimated_departure_hour: Math.floor(departureHour * 100) / 100,
    };
  });

  const totalDurationHours = totalDurationMinutes / 60;

  return {
    optimized_order: routeDetails,
    total_distance_km: Math.round(totalDistance * 100) / 100,
    estimated_duration_hours: Math.round(totalDurationHours * 100) / 100,
    total_service_minutes: serviceDuration,
    sequence: optimizedOrder.map((c) => c.id),
  };
}

// Edge Function handler
serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body: RouteOptimizationInput = await req.json();

    // Validate input
    if (!body.clients || !Array.isArray(body.clients)) {
      return new Response(
        JSON.stringify({ error: "Invalid input: clients array required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!body.start_point || typeof body.start_point.latitude !== "number" || typeof body.start_point.longitude !== "number") {
      return new Response(
        JSON.stringify({
          error: "Invalid input: start_point with latitude and longitude required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate all clients have required fields
    for (const client of body.clients) {
      if (
        !client.id ||
        typeof client.latitude !== "number" ||
        typeof client.longitude !== "number"
      ) {
        return new Response(
          JSON.stringify({
            error: "Invalid client: each client must have id, latitude, and longitude",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get optional parameters with defaults
    const speedKmh = body.speed_kmh || 40;
    const currentHour = body.current_hour || 8;

    // Validate speed and hour
    if (speedKmh <= 0 || speedKmh > 200) {
      return new Response(
        JSON.stringify({ error: "Invalid speed_kmh: must be between 1 and 200" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (currentHour < 0 || currentHour > 23) {
      return new Response(
        JSON.stringify({ error: "Invalid current_hour: must be between 0 and 23" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Run optimization
    const result = optimizeRoute(
      body.clients,
      body.start_point,
      speedKmh,
      currentHour
    );

    // Return optimized route
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in optimize-route function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

// Export for testing/usage outside Edge Function
export { optimizeRoute, calculateDistance };
