import { createFileRoute } from "@tanstack/react-router";
import { Bell, Download, FileText, Lock, Smartphone, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/app/ConfirmReplace";
import { Notice, NumberField, PageHeader, Panel } from "@/components/app/kit";
import { buildBackup, downloadFile, parseBackup } from "@/lib/backup";
import { dayKey } from "@/lib/dates";
import { notificationsSupported, notify, requestNotificationPermission } from "@/lib/notifications";
import { buildReportPdf } from "@/lib/pdf";
import { exportData, useApp } from "@/lib/store";
import type { AppData, NotificationSettings } from "@/lib/types";

export const Route = createFileRoute("/dados")({
  head: () => ({
    meta: [
      { title: "Dados e ajustes — FocusStudy" },
      { name: "description", content: "Metas, notificações, backup em JSON, relatório em PDF e instalação do FocusStudy no celular." },
      { property: "og:title", content: "Dados e ajustes — FocusStudy" },
      { property: "og:description", content: "Seus dados ficam no dispositivo. Exporte, importe e gere relatórios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DataPage,
});

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function DataPage() {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const setAdjustments = useApp((s) => s.setAdjustments);
  const importData = useApp((s) => s.importData);
  const resetAll = useApp((s) => s.resetAll);
  const counts = useApp((s) => ({ sessions: s.sessions.length, doses: s.doses.length, subjects: s.subjects.length }));
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [perm, setPerm] = useState<string>("default");
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPerm(notificationsSupported() ? Notification.permission : "unsupported");
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const n = settings.notifications;
  const setN = (patch: Partial<NotificationSettings>) => setSettings({ notifications: { ...n, ...patch } });

  const enableNotifications = async (on: boolean) => {
    if (!on) return setN({ enabled: false });
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === "granted") {
      setN({ enabled: true });
      toast.success("Notificações ativadas");
    } else if (p === "unsupported") {
      setN({ enabled: true });
      toast("Este navegador não suporta notificações do sistema", { description: "Os avisos aparecerão dentro do app." });
    } else {
      toast.error("Permissão negada", { description: "Libere as notificações nas configurações do navegador." });
    }
  };

  const exportJson = () => {
    const data = exportData(useApp.getState());
    downloadFile(`focusstudy-backup-${dayKey(new Date())}.json`, JSON.stringify(buildBackup(data), null, 2));
    toast.success("Backup exportado");
  };

  const exportPdf = () => {
    const blob = buildReportPdf(exportData(useApp.getState()), new Date());
    downloadFile(`focusstudy-relatorio-${dayKey(new Date())}.pdf`, blob, "application/pdf");
    toast.success("Relatório PDF gerado");
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const r = parseBackup(await f.text());
    if (fileRef.current) fileRef.current.value = "";
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setPendingImport(r.data);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Dados e ajustes" subtitle="Metas, notificações, backup e relatórios." />

      <Panel title="Metas">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Meta total de horas" suffix="h" step={50} min={10} value={settings.targetHours} onChange={(v) => setSettings({ targetHours: v })} />
          <NumberField label="Meta de acertos" suffix="%" step={5} min={10} max={100} value={settings.targetAccuracy} onChange={(v) => setSettings({ targetAccuracy: v })} />
          <NumberField label="Horas por semana" suffix="h" min={1} max={100} value={settings.weeklyHoursGoal} onChange={(v) => setSettings({ weeklyHoursGoal: v })} />
          <NumberField label="Pausa entre blocos" suffix="min" min={0} max={60} value={settings.breakMin} onChange={(v) => setSettings({ breakMin: v })} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Data da prova</label>
            <Input type="date" value={settings.examDate ?? ""} onChange={(e) => setSettings({ examDate: e.target.value || null })} className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Início dos estudos</label>
            <Input type="time" value={settings.studyStartTime} onChange={(e) => setSettings({ studyStartTime: e.target.value || "08:00" })} className="h-10 rounded-xl" />
          </div>
        </div>
        {Object.keys(settings.adjustments).length ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground">{Object.keys(settings.adjustments).length} ajuste(s) de peso do Orientador em uso.</p>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setAdjustments({}); toast.success("Ajustes removidos"); }}>Limpar</Button>
          </div>
        ) : null}
      </Panel>

      <Panel title="Notificações" action={<Bell className="h-4 w-4 text-muted-foreground" />}>
        <div className="space-y-2">
          <Row label="Ativar notificações" checked={n.enabled} onChange={(v) => void enableNotifications(v)} />
          <Row label="Fases estimadas da medicação e horários cadastrados" checked={n.medication} disabled={!n.enabled} onChange={(v) => setN({ medication: v })} />
          <Row label="Início dos estudos (blocos do dia)" checked={n.study} disabled={!n.enabled} onChange={(v) => setN({ study: v })} />
          <Row label="Revisões pendentes" checked={n.reviews} disabled={!n.enabled} onChange={(v) => setN({ reviews: v })} />
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs text-muted-foreground">Permissão do navegador: {perm === "granted" ? "concedida" : perm === "denied" ? "negada" : perm === "unsupported" ? "não suportada" : "não solicitada"}</span>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void notify("Teste do FocusStudy", "As notificações estão funcionando.")}>Testar</Button>
          </div>
          <Notice>Os avisos funcionam enquanto o app estiver aberto ou em segundo plano no celular. Se o navegador for fechado, os lembretes não são disparados.</Notice>
        </div>
      </Panel>

      <Panel title="Backup e relatórios">
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="outline" className="h-11 rounded-xl" onClick={exportJson}><Download /> Exportar JSON</Button>
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => fileRef.current?.click()}><Upload /> Importar JSON</Button>
          <Button className="h-11 rounded-xl" onClick={exportPdf}><FileText /> Relatório PDF</Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <p className="mt-3 text-xs text-muted-foreground">
          Neste dispositivo: {counts.subjects} disciplinas, {counts.sessions} sessões e {counts.doses} registros de medicação. O PDF não inclui registros de medicação.
        </p>
      </Panel>

      <Panel title="Instalar no celular" action={<Smartphone className="h-4 w-4 text-muted-foreground" />}>
        {installed ? (
          <p className="text-sm text-muted-foreground">O FocusStudy já está instalado neste dispositivo.</p>
        ) : installEvt ? (
          <Button className="w-full rounded-xl" onClick={async () => { await installEvt.prompt(); setInstallEvt(null); }}>
            <Smartphone /> Instalar FocusStudy
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">No Chrome do Android, abra o menu ⋮ e toque em “Instalar app” ou “Adicionar à tela inicial”. Funciona no app publicado.</p>
        )}
      </Panel>

      <Panel title="Privacidade" action={<Lock className="h-4 w-4 text-muted-foreground" />}>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• Todos os dados ficam salvos apenas neste dispositivo (armazenamento local do navegador).</li>
          <li>• As análises usam somente os dados que você registrou.</li>
          <li>• A análise com IA é opcional e envia só um resumo agregado de estudos, sem dados de medicação.</li>
          <li>• Os períodos estimados de efeito são referências aproximadas para organizar os estudos, nunca garantia de desempenho ou orientação médica.</li>
          <li>• Limpar os dados do navegador apaga as informações: faça backups periódicos.</li>
        </ul>
      </Panel>

      <Button variant="ghost" className="w-full rounded-xl text-destructive hover:text-destructive" onClick={() => setConfirmReset(true)}>
        <Trash2 /> Apagar todos os dados
      </Button>

      <ConfirmDialog
        open={pendingImport !== null}
        onOpenChange={(v) => !v && setPendingImport(null)}
        title="Substituir dados pelo backup?"
        description={pendingImport ? `O backup tem ${pendingImport.subjects.length} disciplinas e ${pendingImport.sessions.length} sessões. Os dados atuais deste dispositivo serão substituídos.` : ""}
        confirmLabel="Importar"
        onConfirm={() => {
          if (pendingImport) importData(pendingImport);
          setPendingImport(null);
          toast.success("Backup importado");
        }}
      />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Apagar todos os dados?"
        description="Sessões, medicação, cronograma e ajustes serão apagados, e as disciplinas voltam ao padrão do edital. Exporte um backup antes, se quiser guardar."
        confirmLabel="Apagar tudo"
        onConfirm={() => {
          resetAll();
          toast.success("Dados apagados");
        }}
      />
    </div>
  );
}

function Row({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled ?? false} />
    </label>
  );
}
