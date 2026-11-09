import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { TimelineView } from "@/components/timeline-view";

// Timelines live inside each project. This page is the all-projects overview.
export default async function Timeline({ searchParams }: { searchParams: Promise<{ project?: string; zoom?: string; show?: string }> }) {
  const sp = await searchParams;
  if (sp.project && sp.project !== "all") redirect(`/projects/${sp.project}/timeline${sp.zoom ? `?zoom=${sp.zoom}` : ""}`);
  return (
    <>
      <PageTitle title="Projects timeline" sub="Every open project, planned against actual. Open a project for its own timeline." />
      <TimelineView projectId="all" sp={sp} base="/timeline" />
    </>
  );
}
