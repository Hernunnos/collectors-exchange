import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { record } = await req.json()
  
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "CX Waitlist <onboarding@resend.dev>",
      to: "andrew.r.wilkins@gmail.com",
      subject: `New waitlist signup #${record.position} — ${record.name}`,
      html: `
        <h2>◈ New Waitlist Signup</h2>
        <p><strong>Position:</strong> #${record.position}</p>
        <p><strong>Name:</strong> ${record.name}</p>
        <p><strong>Email:</strong> ${record.email}</p>
        <p><strong>Role:</strong> ${record.role}</p>
        <p><strong>Games:</strong> ${record.games?.join(", ")}</p>
        <p><strong>Feature request:</strong> ${record.feature_request || "—"}</p>
        <p><strong>Signed up:</strong> ${record.signed_up_at}</p>
      `
    })
  })

  return new Response("ok")
})