import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";  // use sua instancia do supabase aqui

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData(); // Eduzz envia em Form-Data

    const email = data.get("email");
    const transactionStatus = data.get("status"); // status da transação (aprovado, pendente, etc.)

    if (!email) {
      return NextResponse.json({ error: "Email não enviado" }, { status: 400 });
    }

    if (transactionStatus !== "approved") {
      return NextResponse.json({ message: "Transação não aprovada, ignorando." }, { status: 200 });
    }

    // Atualizar usuário no Supabase
    const { error } = await supabase
      .from("users")
      .update({ status: "active" })
      .eq("email", email);

    if (error) {
      console.error("Erro ao atualizar usuário:", error);
      return NextResponse.json({ error: "Erro ao atualizar usuário" }, { status: 500 });
    }

    return NextResponse.json({ message: "Usuário atualizado com sucesso" }, { status: 200 });
  } catch (err) {
    console.error("Erro no Webhook:", err);
    return NextResponse.json({ error: "Erro no processamento" }, { status: 500 });
  }
}
