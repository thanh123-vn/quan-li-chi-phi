// import { NextResponse } from "next/server"
// import Tesseract from "tesseract.js"

// export const runtime = "nodejs"

// export async function GET() {
//   return NextResponse.json({
//     message: "OCR API đang hoạt động"
//   })
// }

// export async function POST(req: Request) {
//   try {
//     const formData = await req.formData()
//     const file = formData.get("file") as File

//     if (!file) {
//       return NextResponse.json(
//         { error: "No file uploaded" },
//         { status: 400 }
//       )
//     }

//     // convert file -> buffer
//     const bytes = await file.arrayBuffer()
//     const buffer = Buffer.from(bytes)

//     // OCR bằng Tesseract
//     const result = await Tesseract.recognize(
//       buffer,
//       "vie+eng",
//       {
//         logger: m => console.log(m)
//       }
//     )

//     const text = result.data.text

//     return NextResponse.json({ text })

//   } catch (error) {
//     console.error("OCR ERROR:", error)

//     return NextResponse.json(
//       { error: "OCR failed" },
//       { status: 500 }
//     )
//   }
// }
import { NextResponse } from "next/server"
import { createWorker } from "tesseract.js"
export const runtime = "nodejs"


export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const worker = await createWorker()

    await worker.loadLanguage("eng+vie")
    await worker.initialize("eng+vie")

    const { data } = await worker.recognize(buffer)

    await worker.terminate()

    return NextResponse.json({
      text: data.text
    })

  } catch (error) {
    console.error("OCR error:", error)

    return NextResponse.json(
      { error: "OCR failed" },
      { status: 500 }
    )
  }
}