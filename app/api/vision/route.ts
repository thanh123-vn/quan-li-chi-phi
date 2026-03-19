import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { image } = await req.json()

    if (!image) {
      return NextResponse.json({ error: "No image" }, { status: 400 })
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llava-v1.5-7b-4096-preview", // model vision
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
Đọc hóa đơn trong ảnh và trả về JSON:
{
  "amount": number,
  "category": "Nguyên liệu | Điện nước | Lương nhân viên | Thuê mặt bằng | Marketing | Vận chuyển | Bảo trì | Khác",
  "reason": "giải thích ngắn"
}

Chỉ trả JSON, không giải thích thêm.
`,
              },
              {
                type: "image_url",
                image_url: {
                  url: image,
                },
              },
            ],
          },
        ],
        temperature: 0.2,
      }),
    })

    const data = await res.json()

    const text = data.choices?.[0]?.message?.content || "{}"

    // parse JSON an toàn
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = {
        amount: 0,
        category: "Khác",
        reason: "Parse lỗi",
      }
    }

    return NextResponse.json(parsed)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}