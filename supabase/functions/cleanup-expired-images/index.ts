import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const BUCKET = "failure-portal-images";
const RETENTION_DAYS = 30;
const MAX_BATCH = 1000;

type ExpiredReport = {
  id: string;
  attachment_path: string;
};

export default {
  fetch: withSupabase({ auth: ["secret"] }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Método não permitido" }, { status: 405 });
    }

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await context.supabaseAdmin
      .from("failure_portal_reports")
      .select("id,attachment_path")
      .not("attachment_path", "is", null)
      .lt("created_at", cutoff)
      .limit(MAX_BATCH)
      .returns<ExpiredReport[]>();

    if (error) {
      console.error("Falha ao consultar anexos expirados", error.code);
      return Response.json({ error: "Falha ao consultar anexos expirados" }, { status: 500 });
    }

    const expired = data ?? [];
    if (expired.length === 0) {
      return Response.json({ deleted: 0, retentionDays: RETENTION_DAYS });
    }

    const paths = [...new Set(expired.map((report) => report.attachment_path))];
    const { error: storageError } = await context.supabaseAdmin.storage
      .from(BUCKET)
      .remove(paths);

    if (storageError) {
      console.error("Falha ao remover anexos expirados", storageError.name);
      return Response.json({ error: "Falha ao remover anexos expirados" }, { status: 500 });
    }

    const { error: updateError } = await context.supabaseAdmin
      .from("failure_portal_reports")
      .update({
        attachment_path: null,
        attachment_name: null,
        attachment_mime: null,
        attachment_size: null,
      })
      .in("id", expired.map((report) => report.id));

    if (updateError) {
      console.error("Arquivos removidos, mas as referências não foram limpas", updateError.code);
      return Response.json({ error: "Arquivos removidos; referências pendentes" }, { status: 500 });
    }

    return Response.json({
      deleted: paths.length,
      reportsUpdated: expired.length,
      retentionDays: RETENTION_DAYS,
    });
  }),
};
