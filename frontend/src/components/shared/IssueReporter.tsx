import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bug, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiFetch, apiUpload } from '@/lib/api';

export function IssueReporter() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | ''>('');
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  const pageUrl = useMemo(() => window.location.href, []);

  const fetchLabels = async () => {
    try {
      const labels = await apiFetch('/feedback/github-labels');
      if (Array.isArray(labels)) {
        setAvailableLabels(labels.map((l: any) => l.name).filter(Boolean));
      }
    } catch (e) {
      // Quietly ignore label fetch failures
    }
  };

  // open → load labels once
  if (open && availableLabels.length === 0) {
    fetchLabels();
  }

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !pageUrl || !severity) {
      toast({ title: 'All fields are required', description: 'Fill Title, Description, Page URL, and Severity.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      let uploadedUrl: string | undefined;
      if (file && !screenshotUrl) {
        const res = await apiUpload('/feedback/upload-screenshot', file);
        uploadedUrl = res?.url;
        setScreenshotUrl(uploadedUrl || null);
      }
      const result = await apiFetch('/feedback/github-issue', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          pageUrl,
          severity: severity || undefined,
          stepsToReproduce: steps.trim() || undefined,
          expected: expected.trim() || undefined,
          actual: actual.trim() || undefined,
          labels: selectedLabels,
          screenshotUrl: screenshotUrl || uploadedUrl,
        }),
      });
      if ((result as any)?.error) {
        throw new Error((result as any).detail || 'Failed to submit');
      }
      toast({ title: 'Issue submitted', description: 'Thanks for the report!' });
      setOpen(false);
      setTitle('');
      setDescription('');
      setSteps('');
      setExpected('');
      setActual('');
      setSeverity('');
      setSelectedLabels([]);
      setFile(null);
      setScreenshotUrl(null);
    } catch (e: any) {
      toast({ title: 'Submission failed', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-primary-foreground shadow-lg hover:opacity-90"
          title="Report an issue"
        >
          <Bug className="h-4 w-4" />
          <span className="hidden sm:inline">Report issue</span>
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Report an issue</DialogTitle>
            <DialogDescription>Submit a concise report. Your account will be attached automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What happened?" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="space-y-1 sm:col-span-1">
                <label className="text-sm">Severity</label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm">Page URL</label>
                <Input value={pageUrl} readOnly required />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm">Labels</label>
              <div className="flex flex-wrap gap-2">
                {availableLabels.map((name) => {
                  const active = selectedLabels.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedLabels((prev) => active ? prev.filter((n) => n !== name) : [...prev, name])}
                      className={`px-2 py-1 rounded border text-xs ${active ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm">Steps to reproduce</label>
              <Textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} placeholder="1. ... 2. ... 3. ..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm">Expected</label>
                <Textarea value={expected} onChange={(e) => setExpected(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1">
                <label className="text-sm">Actual</label>
                <Textarea value={actual} onChange={(e) => setActual(e.target.value)} rows={2} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm">Screenshot (optional)</label>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Submitting</span> : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


