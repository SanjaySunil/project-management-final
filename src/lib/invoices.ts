import { supabase } from "./supabase"

export async function getNextInvoiceNumber(): Promise<string> {
  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number")
    .order("invoice_number", { ascending: false })
    .limit(1)

  if (error) {
    console.error("Error fetching last invoice number:", error)
    return "INV-0001"
  }

  if (!data || data.length === 0) {
    return "INV-0001"
  }

  const lastNumber = data[0].invoice_number
  const match = lastNumber.match(/INV-(\d+)/)
  
  if (match) {
    const nextNum = parseInt(match[1]) + 1
    return `INV-${nextNum.toString().padStart(4, "0")}`
  }

  return "INV-0001"
}
