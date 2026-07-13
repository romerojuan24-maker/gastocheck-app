// Edge Function: process-advisor-queue
// Processes pending signal correlation jobs from advisor_signal_queue
// Runs every 15 seconds via Supabase Scheduler
//
// Logic:
// 1. Fetch pending jobs (one per company, ordered by queued_at)
// 2. Check 60-second rate limit for each company
// 3. Invoke advisor-correlate with company_id
// 4. Mark job as COMPLETED or FAILED
// 5. Update cooldown table

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

interface PendingJob {
  id: string
  company_id: string
  event_type: string
  retries: number
  max_retries: number
  queued_at: string
}

interface CorrelateResponse {
  success: boolean
  signals_evaluated?: number
  insights_created?: number
  insights_updated?: number
  error?: string
}

async function invokeCorrelate(
  supabaseUrl: string,
  serviceRoleKey: string,
  companyId: string,
): Promise<CorrelateResponse> {
  const response = await fetch(`${supabaseUrl}/functions/v1/advisor-correlate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ company_id: companyId }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`advisor-correlate failed: ${error}`)
  }

  return response.json()
}

async function checkRateLimit(admin: any, companyId: string): Promise<boolean> {
  const { data } = await admin
    .from('advisor_correlate_cooldown')
    .select('next_allowed_at')
    .eq('company_id', companyId)
    .maybeSingle()

  if (!data || !data.next_allowed_at) {
    return true
  }

  return new Date() >= new Date(data.next_allowed_at)
}

async function updateCooldown(admin: any, companyId: string): Promise<void> {
  const nextAllowed = new Date()
  nextAllowed.setSeconds(nextAllowed.getSeconds() + 60)

  await admin
    .from('advisor_correlate_cooldown')
    .upsert({
      company_id: companyId,
      last_run_at: new Date().toISOString(),
      next_allowed_at: nextAllowed.toISOString(),
      updated_at: new Date().toISOString(),
    })
}

async function markJobCompleted(admin: any, jobId: string): Promise<void> {
  await admin
    .from('advisor_signal_queue')
    .update({
      status: 'COMPLETED',
      processed_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

async function markJobFailed(
  admin: any,
  jobId: string,
  error: string,
  retries: number,
  maxRetries: number,
): Promise<void> {
  if (retries >= maxRetries) {
    await admin
      .from('advisor_signal_queue')
      .update({
        status: 'FAILED',
        last_error: error,
        processed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  } else {
    await admin
      .from('advisor_signal_queue')
      .update({
        retries: retries + 1,
        last_error: error,
      })
      .eq('id', jobId)
  }
}

async function getPendingJobs(admin: any): Promise<PendingJob[]> {
  const { data, error } = await admin
    .from('advisor_signal_queue')
    .select('*')
    .eq('status', 'PENDING')
    .order('queued_at', { ascending: true })
    .limit(100)

  if (error) {
    console.error('Error fetching pending jobs:', error)
    return []
  }

  // Group by company_id to process one job per company
  const jobsByCompany = new Map<string, PendingJob>()
  for (const job of data || []) {
    if (!jobsByCompany.has(job.company_id)) {
      jobsByCompany.set(job.company_id, job)
    }
  }

  return Array.from(jobsByCompany.values())
}

export async function processQueue(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    console.log('[process-advisor-queue] Starting queue processing...')

    const jobs = await getPendingJobs(admin)
    console.log(`[process-advisor-queue] Found ${jobs.length} pending job(s)`)

    let processed = 0
    let skipped = 0
    let failed = 0

    for (const job of jobs) {
      try {
        // Check rate limit for this company
        const canRun = await checkRateLimit(admin, job.company_id)
        if (!canRun) {
          console.log(`[process-advisor-queue] Rate limited: ${job.company_id}`)
          skipped++
          continue
        }

        console.log(
          `[process-advisor-queue] Processing: company=${job.company_id}, event=${job.event_type}`,
        )

        // Invoke advisor-correlate
        const result = await invokeCorrelate(supabaseUrl, serviceRoleKey, job.company_id)

        console.log(`[process-advisor-queue] Correlate result:`, {
          company_id: job.company_id,
          signals_evaluated: result.signals_evaluated,
          insights_created: result.insights_created,
          insights_updated: result.insights_updated,
        })

        // Mark job as completed
        await markJobCompleted(admin, job.id)

        // Update cooldown
        await updateCooldown(admin, job.company_id)

        processed++
      } catch (err: any) {
        const errorMsg = err.message || String(err)
        console.error(`[process-advisor-queue] Job failed: ${errorMsg}`, {
          job_id: job.id,
          company_id: job.company_id,
          event_type: job.event_type,
        })

        await markJobFailed(admin, job.id, errorMsg, job.retries, job.max_retries)
        failed++
      }
    }

    const response = {
      success: true,
      jobs_found: jobs.length,
      jobs_processed: processed,
      jobs_skipped: skipped,
      jobs_failed: failed,
      timestamp: new Date().toISOString(),
    }

    console.log('[process-advisor-queue] Queue processing completed:', response)

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', ...CORS },
      status: 200,
    })
  } catch (err: any) {
    const errorMsg = err.message || String(err)
    console.error('[process-advisor-queue] Fatal error:', errorMsg)

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json', ...CORS },
        status: 500,
      },
    )
  }
}

Deno.serve(processQueue)
