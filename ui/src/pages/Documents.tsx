import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Download, History, Trash2, Save, RotateCcw } from "lucide-react";
import { documentsApi, type LibraryDocument } from "../api/documents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToastActions } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { ApiError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function Documents() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToastActions();
  const queryClient = useQueryClient();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Documents" }]);
  }, [setBreadcrumbs]);

  const companyId = selectedCompanyId ?? "";

  const { data: documents, isLoading } = useQuery({
    queryKey: queryKeys.documents.list(companyId),
    queryFn: () => documentsApi.list(companyId),
    enabled: !!companyId,
  });

  const { data: selectedDoc } = useQuery({
    queryKey: queryKeys.documents.detail(companyId, selectedSlug ?? ""),
    queryFn: () => documentsApi.get(companyId, selectedSlug!),
    enabled: !!companyId && !!selectedSlug,
  });

  // Load the document body into the editor draft when the selection changes.
  useEffect(() => {
    if (selectedDoc) setDraftBody(selectedDoc.body ?? "");
  }, [selectedDoc?.id, selectedDoc?.latestRevisionId]);

  const { data: revisions } = useQuery({
    queryKey: queryKeys.documents.revisions(companyId, selectedSlug ?? ""),
    queryFn: () => documentsApi.listRevisions(companyId, selectedSlug!),
    enabled: !!companyId && !!selectedSlug && showRevisions,
  });

  function invalidateDoc(slug: string) {
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.list(companyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.detail(companyId, slug) });
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.revisions(companyId, slug) });
  }

  const saveDoc = useMutation({
    mutationFn: (vars: { slug: string; body: string; baseRevisionId: string | null }) =>
      documentsApi.upsert(companyId, vars.slug, { body: vars.body, baseRevisionId: vars.baseRevisionId }),
    onSuccess: (res) => {
      invalidateDoc(res.document.slug ?? "");
      pushToast({ title: "Saved", tone: "success" });
    },
    onError: (err) => pushToast({ title: "Save failed", body: errorMessage(err), tone: "error" }),
  });

  const createDoc = useMutation({
    mutationFn: (vars: { slug: string; title: string; path: string | null }) =>
      documentsApi.upsert(companyId, vars.slug, {
        title: vars.title || null,
        path: vars.path,
        body: `# ${vars.title || vars.slug}\n\n`,
      }),
    onSuccess: (res) => {
      const slug = res.document.slug ?? "";
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.list(companyId) });
      setSelectedSlug(slug);
      setCreateOpen(false);
      pushToast({ title: "Document created", tone: "success" });
    },
    onError: (err) => pushToast({ title: "Create failed", body: errorMessage(err), tone: "error" }),
  });

  const setRetention = useMutation({
    mutationFn: (vars: { slug: string; policy: "keep_all" | "current_only" }) =>
      documentsApi.setRetention(companyId, vars.slug, vars.policy),
    onSuccess: (res, vars) => {
      invalidateDoc(vars.slug);
      pushToast({
        title: `Retention: ${vars.policy === "keep_all" ? "Keep all versions" : "Current only"}`,
        body: res.prunedRevisionCount > 0 ? `${res.prunedRevisionCount} old version(s) pruned` : undefined,
        tone: "success",
      });
    },
    onError: (err) => pushToast({ title: "Update failed", body: errorMessage(err), tone: "error" }),
  });

  const restoreRevision = useMutation({
    mutationFn: (vars: { slug: string; revisionId: string }) =>
      documentsApi.restoreRevision(companyId, vars.slug, vars.revisionId),
    onSuccess: (_res, vars) => {
      invalidateDoc(vars.slug);
      pushToast({ title: "Revision restored", tone: "success" });
    },
    onError: (err) => pushToast({ title: "Restore failed", body: errorMessage(err), tone: "error" }),
  });

  const discardRevision = useMutation({
    mutationFn: (vars: { slug: string; revisionId: string }) =>
      documentsApi.discardRevision(companyId, vars.slug, vars.revisionId),
    onSuccess: (res, vars) => {
      invalidateDoc(vars.slug);
      pushToast({ title: `Version ${res.discardedRevisionNumber} discarded`, tone: "success" });
    },
    onError: (err) => pushToast({ title: "Discard failed", body: errorMessage(err), tone: "error" }),
  });

  const sortedDocs = useMemo(
    () => (documents ? [...documents].sort((a, b) => (a.title ?? a.slug ?? "").localeCompare(b.title ?? b.slug ?? "")) : []),
    [documents],
  );

  if (!selectedCompanyId) {
    return <EmptyState icon={FileText} message="Select a company to view documents." />;
  }
  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const dirty = !!selectedDoc && draftBody !== (selectedDoc.body ?? "");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Documents</h1>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Document
        </Button>
      </div>

      {sortedDocs.length === 0 ? (
        <EmptyState
          icon={FileText}
          message="No documents yet. Create one — it'll be mirrored to file storage automatically."
          action="New Document"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-[18rem_1fr] gap-4">
          {/* Document list */}
          <div className="border border-border rounded-lg overflow-hidden h-fit">
            {sortedDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => {
                  setSelectedSlug(doc.slug);
                  setShowRevisions(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 border-b border-border last:border-b-0 hover:bg-accent/50 transition-colors",
                  selectedSlug === doc.slug && "bg-accent text-accent-foreground",
                )}
              >
                <div className="text-sm font-medium truncate">{doc.title || doc.slug}</div>
                <div className="text-xs font-mono text-muted-foreground truncate">
                  {doc.path ? `${doc.path}/` : ""}
                  {doc.slug}
                </div>
              </button>
            ))}
          </div>

          {/* Editor pane */}
          <div className="min-w-0">
            {!selectedDoc ? (
              <div className="border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
                Select a document to view and edit it.
              </div>
            ) : (
              <DocumentEditorPane
                doc={selectedDoc}
                body={draftBody}
                dirty={dirty}
                saving={saveDoc.isPending}
                onChangeBody={setDraftBody}
                onSave={() =>
                  saveDoc.mutate({ slug: selectedDoc.slug!, body: draftBody, baseRevisionId: selectedDoc.latestRevisionId })
                }
                onSetRetention={(policy) => setRetention.mutate({ slug: selectedDoc.slug!, policy })}
                retentionPending={setRetention.isPending}
                companyId={companyId}
                showRevisions={showRevisions}
                onToggleRevisions={() => setShowRevisions((v) => !v)}
                revisions={revisions ?? []}
                onRestore={(revisionId) => restoreRevision.mutate({ slug: selectedDoc.slug!, revisionId })}
                onDiscard={(revisionId) => discardRevision.mutate({ slug: selectedDoc.slug!, revisionId })}
              />
            )}
          </div>
        </div>
      )}

      <CreateDocumentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingSlugs={(documents ?? []).map((d) => d.slug ?? "")}
        pending={createDoc.isPending}
        onCreate={(title, slug, path) => createDoc.mutate({ slug, title, path })}
      />
    </div>
  );
}

function DocumentEditorPane(props: {
  doc: LibraryDocument;
  body: string;
  dirty: boolean;
  saving: boolean;
  onChangeBody: (v: string) => void;
  onSave: () => void;
  onSetRetention: (policy: "keep_all" | "current_only") => void;
  retentionPending: boolean;
  companyId: string;
  showRevisions: boolean;
  onToggleRevisions: () => void;
  revisions: { id: string; revisionNumber: number; changeSummary: string | null; createdAt: string }[];
  onRestore: (revisionId: string) => void;
  onDiscard: (revisionId: string) => void;
}) {
  const { doc } = props;
  const slug = doc.slug ?? "";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-lg font-semibold truncate">{doc.title || slug}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{slug}</span>
            <span>·</span>
            <span>v{doc.latestRevisionNumber}</span>
            {doc.mirroredAt ? (
              <Badge variant="secondary" className="text-[10px]">mirrored</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">not mirrored</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={doc.retentionPolicy} onValueChange={(v) => props.onSetRetention(v as "keep_all" | "current_only")}>
            <SelectTrigger className="h-8 w-[150px] text-xs" disabled={props.retentionPending}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep_all">Keep all versions</SelectItem>
              <SelectItem value="current_only">Current only</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" asChild>
            <a href={documentsApi.fileUrl(props.companyId, slug, { download: true })} target="_blank" rel="noreferrer">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={props.onToggleRevisions}>
            <History className="h-3.5 w-3.5 mr-1.5" />
            History
          </Button>
          <Button size="sm" onClick={props.onSave} disabled={!props.dirty || props.saving}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {props.saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <MarkdownEditor value={props.body} onChange={props.onChangeBody} bordered onSubmit={props.onSave} />

      {props.showRevisions && (
        <div className="border border-border rounded-lg">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
            <History className="h-3.5 w-3.5" />
            <span className="text-sm font-medium">Version history</span>
            <span className="text-xs text-muted-foreground ml-1">{props.revisions.length}</span>
          </div>
          {props.revisions.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">No revisions.</div>
          ) : (
            props.revisions.map((rev) => {
              const isLatest = rev.id === doc.latestRevisionId;
              return (
                <div
                  key={rev.id}
                  className="flex items-center justify-between px-3 py-2 border-b border-border last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm flex items-center gap-2">
                      <span className="font-mono">v{rev.revisionNumber}</span>
                      {isLatest && <Badge variant="secondary" className="text-[10px]">current</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {rev.changeSummary || new Date(rev.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isLatest}
                      onClick={() => props.onRestore(rev.id)}
                      title="Restore this version"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isLatest}
                      onClick={() => props.onDiscard(rev.id)}
                      title={isLatest ? "Cannot discard the current version" : "Discard this version"}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function CreateDocumentDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSlugs: string[];
  pending: boolean;
  onCreate: (title: string, slug: string, path: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [path, setPath] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (props.open) {
      setTitle("");
      setSlug("");
      setPath("");
      setSlugTouched(false);
    }
  }, [props.open]);

  const effectiveSlug = slugTouched ? slug : slugify(title);
  const slugTaken = props.existingSlugs.includes(effectiveSlug);
  const canCreate = effectiveSlug.length > 0 && !slugTaken && !props.pending;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Operating Charter" autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Slug</label>
            <Input
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="operating-charter"
            />
            {slugTaken && <p className="text-xs text-destructive">A document with this slug already exists.</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Folder path (optional)</label>
            <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="playbooks" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canCreate}
            onClick={() => props.onCreate(title, effectiveSlug, path.trim() ? slugify(path) : null)}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
