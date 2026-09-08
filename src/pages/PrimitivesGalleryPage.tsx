import { useState } from "react";
import AppFeaturePage from "../components/AppFeaturePage";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Callout } from "../components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { Input } from "../components/ui/input";
import { SegmentedControl } from "../components/ui/segmented-control";
import { SettingsRow, SettingsSection } from "../components/ui/settings-row";
import { Skeleton } from "../components/ui/skeleton";
import { StatCard } from "../components/ui/stat-card";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Toast } from "../components/ui/toast";

/** Dev gallery for visual-system primitives (both themes via ThemeToggle). */
export default function PrimitivesGalleryPage() {
  const [seg, setSeg] = useState("week");
  const [toastOpen, setToastOpen] = useState(true);

  return (
    <AppFeaturePage
      current="settings"
      title="Primitives"
      subtitle="Visual system gallery — switch theme from the sidebar to verify both modes."
    >
      <div className="stack gap-8">
        <section className="stack gap-3">
          <h2 className="text-[15px] font-semibold">Buttons</h2>
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="inverse">Inverse</Button>
            <Button size="pill">Pill</Button>
          </div>
        </section>

        <section className="stack gap-3">
          <h2 className="text-[15px] font-semibold">Inputs & switch</h2>
          <Input placeholder="Search messages…" className="max-w-sm" />
          <div className="flex items-center gap-2">
            <Switch id="gallery-switch" />
            <label htmlFor="gallery-switch" className="text-sm text-[var(--foreground-muted)]">
              Notifications
            </label>
          </div>
        </section>

        <section className="stack gap-3">
          <h2 className="text-[15px] font-semibold">Badges</h2>
          <div className="flex flex-wrap gap-2">
            <Badge>Accent</Badge>
            <Badge variant="success">Verified</Badge>
            <Badge variant="warn">Pending</Badge>
            <Badge variant="danger">Failed</Badge>
            <Badge variant="secondary">Shared</Badge>
          </div>
        </section>

        <section className="stack gap-3">
          <h2 className="text-[15px] font-semibold">Tabs & segmented</h2>
          <Tabs defaultValue="a">
            <TabsList>
              <TabsTrigger value="a">General</TabsTrigger>
              <TabsTrigger value="b">Team</TabsTrigger>
              <TabsTrigger value="c">Billing</TabsTrigger>
            </TabsList>
            <TabsContent value="a">General content</TabsContent>
            <TabsContent value="b">Team content</TabsContent>
            <TabsContent value="c">Billing content</TabsContent>
          </Tabs>
          <SegmentedControl
            aria-label="Calendar view"
            value={seg}
            onChange={setSeg}
            options={[
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
              { value: "day", label: "Day" },
            ]}
          />
        </section>

        <section className="stack gap-3">
          <h2 className="text-[15px] font-semibold">Cards & stats</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Sent" value="1,284" comparison="+12% vs prior" comparisonTone="up" />
            <StatCard label="Incoming" value="842" comparison="Comparison unavailable" />
            <Card>
              <CardHeader>
                <CardTitle>Card</CardTitle>
                <CardDescription>Radius 16px, no app shadow.</CardDescription>
              </CardHeader>
              <CardContent>Body content</CardContent>
            </Card>
            <Skeleton className="h-28 w-full" />
          </div>
        </section>

        <SettingsSection title="Settings row" description="Label left, control right.">
          <SettingsRow label="Organization name" helper="Shown on invoices.">
            <Input defaultValue="Flap" />
          </SettingsRow>
          <SettingsRow label="Public profile">
            <Switch />
          </SettingsRow>
        </SettingsSection>

        <Callout variant="warning">Bounce rate is above 2%. Review the suppression list.</Callout>

        <EmptyState
          title="No domains connected"
          body="Register a new domain or connect an existing one to start sending and receiving email."
          primaryAction={{ label: "Add domain", onClick: () => undefined }}
          secondaryAction={{ label: "Setup guide", onClick: () => undefined }}
        />

        {toastOpen ? (
          <Toast
            eyebrow="Security"
            title="Scope API keys to a mailbox"
            body="Limit blast radius when an agent key leaks."
            onDismiss={() => setToastOpen(false)}
          />
        ) : null}
      </div>
    </AppFeaturePage>
  );
}
