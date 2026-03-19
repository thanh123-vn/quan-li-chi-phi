// import { NextResponse } from 'next/server'
// import OpenAI from 'openai'

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// })

// export async function POST(request: Request) {
//   try {
//     const { text, categories } = await request.json()

//     if (!text) {
//       return NextResponse.json(
//         { error: 'No text provided' },
//         { status: 400 }
//       )
//     }

//     const prompt = `
//     Dựa vào nội dung hóa đơn sau, hãy phân loại chi phí này vào một trong các danh mục: ${categories.join(', ')}.
    
//     Nội dung hóa đơn:
//     ${text.substring(0, 1000)}
    
//     Chỉ trả về tên danh mục phù hợp nhất, không giải thích thêm.
//     `

//     const completion = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [
//         { role: "system", content: "Bạn là chuyên gia phân loại chi phí cho doanh nghiệp." },
//         { role: "user", content: prompt }
//       ],
//       temperature: 0.3,
//       max_tokens: 50
//     })

//     const category = completion.choices[0].message.content?.trim() || "Khác"

//     return NextResponse.json({ category })
    
//   } catch (error) {
//     console.error('Classification Error:', error)
//     return NextResponse.json(
//       { category: "Khác" } // Default category on error
//     )
//   }
// }

// import { NextResponse } from "next/server"

// export async function POST(req: Request) {
//   try {
//     const body = await req.json()
//     const { text, categories } = body

//     if (!text) {
//       return NextResponse.json(
//         { error: "Missing OCR text" },
//         { status: 400 }
//       )
//     }

//     const prompt = `
// Phân loại chi phí sau vào 1 trong các danh mục:

// ${categories.join(", ")}

// Nội dung hóa đơn:
// ${text}

// Chỉ trả về đúng tên danh mục.
// `

//     const res = await fetch(
//       "https://api.groq.com/openai/v1/chat/completions",
//       {
//         method: "POST",
//         headers: {
//           "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
//           "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//           model: "llama3-8b-8192",
//           messages: [
//             {
//               role: "user",
//               content: prompt
//             }
//           ]
//         })
//       }
//     )

//     const data = await res.json()

//     const category =
//       data.choices?.[0]?.message?.content?.trim() || "Khác"

//     return NextResponse.json({ category })

//   } catch (error) {
//     console.error(error)
//     return NextResponse.json(
//       { error: "Classification failed" },
//       { status: 500 }
//     )
//   }
// }
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { text, rawText, categories } = body

if ((!text || text.trim().length < 10) && (!rawText || rawText.trim().length < 10)) {
  return NextResponse.json({ category: "Khác" })
}

if (!categories || !Array.isArray(categories)) {
  return NextResponse.json({ category: "Khác" })
}
    // FIX 1: Dùng cả rawText lẫn text nếu có
    const inputText = (rawText || text).substring(0, 1500)

    // FIX 2: Prompt rõ ràng hơn, có system role, ép trả đúng tên danh mục
    const prompt = `Bạn là hệ thống phân loại chi phí doanh nghiệp.

Danh sách danh mục hợp lệ (chỉ được chọn 1 trong các danh mục này):
${categories.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}

Nội dung hóa đơn:
"""
${inputText}
"""

Quy tắc:
- Chỉ trả về DUY NHẤT tên danh mục, không giải thích, không thêm chữ nào khác
- Nếu không chắc, trả về: Khác
- Ví dụ trả lời đúng: Nguyên liệu
- Ví dụ trả lời SAI: "Danh mục là Nguyên liệu" hoặc "1. Nguyên liệu"

Trả lời:`

    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [
            {
              // FIX 3: Thêm system prompt để model hiểu vai trò
              role: "system",
              content:
                "Bạn là công cụ phân loại chi phí. Chỉ trả về đúng tên danh mục, không có gì khác."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,   // FIX 4: Giảm temperature để output ổn định hơn
          max_tokens: 20      // FIX 5: Giới hạn token — tên danh mục không cần dài
        })
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error("Groq API error:", errText)
      return NextResponse.json({ category: "Khác" })
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content?.trim() || ""

    console.log("AI raw response:", raw)

    // FIX 6: Validate — tìm danh mục khớp trong danh sách, tránh lưu text lạ
    const matched = categories.find((cat: string) =>
      raw.toLowerCase().includes(cat.toLowerCase())
    )

    const category = matched || "Khác"

    console.log("Final category:", category)

    return NextResponse.json({ category })

  } catch (error) {
    console.error("Classification error:", error)
    return NextResponse.json(
      { category: "Khác" },
      { status: 200 } // Trả 200 để page.tsx không throw lỗi
    )
  }
}