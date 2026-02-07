import { supabase } from "./supabase";

/**
 * Automatically updates a project's status based on its proposals.
 * Rule:
 * - Status is "active" if it has at least one "active" or "sent" proposal.
 * - Status is "completed" if it has no "active"/"sent" proposals (all are complete, rejected, or draft, or no proposals exist).
 */
export async function updateProjectStatus(projectId: string) {
  try {
    const { data: proposals, error: proposalsError } = await supabase
      .from("proposals")
      .select("status")
      .eq("project_id", projectId);

    if (proposalsError) throw proposalsError;

    let newStatus = "completed";

    if (proposals && proposals.length > 0) {
      // "active" or "sent" proposals mean the project is active
      const hasActive = proposals.some((p) => p.status === "active" || p.status === "sent");
      if (hasActive) {
        newStatus = "active";
      } else {
        newStatus = "completed";
      }
    } else {
      // If no proposals exist, it's considered completed (or could be 'draft', but 'completed' is the requested default for no active work)
      newStatus = "completed";
    }

    const { error: projectError } = await supabase
      .from("projects")
      .update({ status: newStatus })
      .eq("id", projectId);

    if (projectError) throw projectError;
    
    return newStatus;
  } catch (error) {
    console.error("Error updating project status:", error);
    throw error;
  }
}