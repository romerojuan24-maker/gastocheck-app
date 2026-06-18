// Advisor IA - Claude API integration
export async function askAdvisor(question: string, context: any) {
  try {
    // Call Claude via Anthropic API (requires ANTHROPIC_API_KEY)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: `Eres un asesor financiero experto para PyMEs mexicanas. 
Contexto de la empresa:
- Clientes totales: ${context.totalClients}
- Cartera por cobrar: $${context.totalCartera}
- Facturas vencidas: ${context.overdue}
- Score de riesgo promedio: ${context.avgRisk}/100
- Saldo bancario: $${context.bankBalance}

Responde en español, de forma concisa y accionable. Enfócate en recomendaciones prácticas.`,
        messages: [{ role: 'user', content: question }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    const data = await response.json();
    const answer = data.content?.[0]?.text || 'Sin respuesta';
    
    return { answer, success: true };
  } catch (error: any) {
    console.error('Advisor error:', error);
    return { 
      answer: 'Error al consultar al Advisor. Intenta más tarde.',
      success: false,
      error: error.message 
    };
  }
}
