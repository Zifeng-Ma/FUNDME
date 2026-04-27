import { NextResponse } from 'next/server';

export async function POST() {
  const appId = process.env.RECLAIM_APP_ID;
  const appSecret = process.env.RECLAIM_APP_SECRET;
  const providerId = process.env.RECLAIM_PROVIDER_ID;

  if (!appId || !appSecret || !providerId) {
    return NextResponse.json(
      { error: 'Reclaim credentials not configured on server.' },
      { status: 500 },
    );
  }

  try {
    const { ReclaimProofRequest } = await import('@reclaimprotocol/js-sdk');
    const proofRequest = await ReclaimProofRequest.init(appId, appSecret, providerId);
    const requestUrl = await proofRequest.getRequestUrl({ verificationMode: 'app' });
    const serialized = proofRequest.toJsonString();
    return NextResponse.json({ requestUrl, serialized });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to initialize Reclaim session' },
      { status: 500 },
    );
  }
}
