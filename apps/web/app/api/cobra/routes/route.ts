import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'CobraCheck — coming soon' }, { status: 501 })
}

export async function POST() {
  return NextResponse.json({ error: 'CobraCheck — coming soon' }, { status: 501 })
}
