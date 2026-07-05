/**
 * BancoCheck API Routes
 * Base: /api/banco/*
 */

import { NextRequest, NextResponse } from 'next/server'

// ============================================================================
// POST /api/banco/import-statement
// Import PDF/JPG bank statement (OCR)
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const { method, pathname } = req.nextUrl
    const body = await req.json()

    if (pathname.includes('/import-statement')) {
      return await handleImportStatement(body)
    }
    if (pathname.includes('/oauth-callback')) {
      return await handleOAuthCallback(body)
    }
    if (pathname.includes('/manual-match')) {
      return await handleManualMatch(body)
    }

    return NextResponse.json({ error: 'Unknown endpoint' }, { status: 404 })
  } catch (error) {
    console.error('BancoCheck API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================================
// GET /api/banco/accounts
// Get connected bank accounts
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.pathname.includes('/accounts')) {
      return await handleGetAccounts(req)
    }
    if (req.nextUrl.pathname.includes('/transactions')) {
      return await handleGetTransactions(req)
    }
    if (req.nextUrl.pathname.includes('/unsupported-banks')) {
      return await handleGetUnsupportedBanks(req)
    }

    return NextResponse.json({ error: 'Unknown endpoint' }, { status: 404 })
  } catch (error) {
    console.error('BancoCheck API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================================
// Handlers
// ============================================================================

async function handleImportStatement(body: any) {
  try {
    const { company_id, file_format, file_url } = body

    if (!company_id || !file_format) {
      return NextResponse.json(
        { error: 'Missing: company_id, file_format' },
        { status: 400 }
      )
    }

    // STUB: OCR processing
    // TODO: Integrate Tesseract/AWS Textract after migrations
    console.log('[STUB] Processing statement:', file_url, 'format:', file_format)

    const import_record = {
      id: crypto.randomUUID(),
      company_id,
      file_format,
      file_url,
      processing_status: 'processing',
      total_transactions: 0,
      created_at: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: import_record,
    })
  } catch (error) {
    console.error('handleImportStatement error:', error)
    return NextResponse.json({ error: 'Failed to import statement' }, { status: 500 })
  }
}

async function handleGetAccounts(req: NextRequest) {
  try {
    const company_id = req.nextUrl.searchParams.get('company_id')

    if (!company_id) {
      return NextResponse.json(
        { error: 'Missing: company_id' },
        { status: 400 }
      )
    }

    // STUB: Return connected accounts
    // TODO: Query bank_accounts_manual + bank_accounts_automated after migrations
    const accounts = {
      manual_accounts: [],
      automated_accounts: [],
    }

    console.log('[STUB] Fetched accounts for company:', company_id)

    return NextResponse.json({
      success: true,
      data: accounts,
    })
  } catch (error) {
    console.error('handleGetAccounts error:', error)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

async function handleGetTransactions(req: NextRequest) {
  try {
    const company_id = req.nextUrl.searchParams.get('company_id')
    const account_id = req.nextUrl.searchParams.get('account_id')
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')

    if (!company_id) {
      return NextResponse.json(
        { error: 'Missing: company_id' },
        { status: 400 }
      )
    }

    // STUB: Return transactions
    // TODO: Query bank_transactions after migrations
    const transactions = []

    console.log('[STUB] Fetched transactions for company:', company_id)

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        total: 0,
        matching_summary: {
          total: 0,
          matched: 0,
          unmatched: 0,
          percentage: 0,
        },
      },
    })
  } catch (error) {
    console.error('handleGetTransactions error:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

async function handleOAuthCallback(body: any) {
  try {
    const { company_id, oauth_provider, auth_code } = body

    if (!company_id || !oauth_provider || !auth_code) {
      return NextResponse.json(
        { error: 'Missing: company_id, oauth_provider, auth_code' },
        { status: 400 }
      )
    }

    // STUB: Exchange auth_code for tokens
    // TODO: Implement actual OAuth token exchange after migrations
    console.log('[STUB] OAuth callback for provider:', oauth_provider)

    const account = {
      id: crypto.randomUUID(),
      company_id,
      oauth_provider,
      account_name: `Cuenta ${oauth_provider}`,
      sync_status: 'connected',
      created_at: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: account,
    })
  } catch (error) {
    console.error('handleOAuthCallback error:', error)
    return NextResponse.json({ error: 'OAuth callback failed' }, { status: 500 })
  }
}

async function handleManualMatch(body: any) {
  try {
    const { company_id, transaction_a_id, transaction_b_id } = body

    if (!company_id || !transaction_a_id || !transaction_b_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // STUB: Create manual match
    // TODO: Update transaction_matching_log and bank_transactions after migrations
    console.log('[STUB] Manual match:', transaction_a_id, 'with', transaction_b_id)

    return NextResponse.json({
      success: true,
      data: {
        matched: true,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('handleManualMatch error:', error)
    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 })
  }
}

async function handleGetUnsupportedBanks(req: NextRequest) {
  try {
    const company_id = req.nextUrl.searchParams.get('company_id')

    if (!company_id) {
      return NextResponse.json(
        { error: 'Missing: company_id' },
        { status: 400 }
      )
    }

    // STUB: Return unsupported bank requests
    // TODO: Query unsupported_bank_requests after migrations
    const requests = []

    console.log('[STUB] Fetched unsupported bank requests for company:', company_id)

    return NextResponse.json({
      success: true,
      data: {
        requests,
        top_requested: [],
      },
    })
  } catch (error) {
    console.error('handleGetUnsupportedBanks error:', error)
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
  }
}
