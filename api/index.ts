import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || "/";
  console.log(`[VERCEL DEBUG] Incoming: ${url}`);
  
  if (url.includes('/api/ping')) {
    return res.status(200).json({ status: "minimal_ok", message: "Bare Engine Running" });
  }

  res.status(200).json({ 
    message: "Diagnostic Mode",
    url: url,
    method: req.method
  });
}
