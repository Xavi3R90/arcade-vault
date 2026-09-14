import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY is not configured on the server.' },
      { status: 500 }
    );
  }

  const to = process.env.CONTACT_TO_EMAIL;
  if (!to) {
    return NextResponse.json(
      { error: 'CONTACT_TO_EMAIL is not configured on the server.' },
      { status: 500 }
    );
  }

  const resend = new Resend(apiKey);

  let body: { name?: string; email?: string; msg?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { name, email, msg } = body;
  if (!name?.trim() || !email?.trim() || !msg?.trim()) {
    return NextResponse.json(
      { error: 'name, email and msg are required.' },
      { status: 400 }
    );
  }

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to,
      subject: `[Arcade Vault] Mensaje de ${name}`,
      html: `<p><strong>Nombre:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Mensaje:</strong></p><p>${msg}</p>`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
