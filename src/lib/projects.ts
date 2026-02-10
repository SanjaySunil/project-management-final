import { supabase } from "./supabase";

/**
 * Automatically updates a project's status based on its phases.
 * Rule:
 * - Status is "active" if it has at least one "active" or "sent" phase.
 * - Status is "completed" if it has no "active"/"sent" phases (all are complete, rejected, or draft, or no phases exist).
 */
export async function updateProjectStatus(projectId: string) {
  try {
    const { data: phases, error: phasesError } = await supabase
      .from("phases")
      .select("status")
      .eq("project_id", projectId);

    if (phasesError) throw phasesError;

    let newStatus = "completed";

    if (phases && phases.length > 0) {
      // "active" or "sent" phases mean the project is active
      const hasActive = phases.some((p) => p.status === "active" || p.status === "sent");
      if (hasActive) {
        newStatus = "active";
      } else {
        newStatus = "completed";
      }
    } else {
      // If no phases exist, it's considered completed (or could be 'draft', but 'completed' is the requested default for no active work)
      newStatus = "completed";
    }

    // Get current project status to avoid unnecessary updates
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("status")
      .eq("id", projectId)
      .single();

    if (fetchError) throw fetchError;

    if (project.status !== newStatus) {
      const { error: projectError } = await supabase
        .from("projects")
        .update({ status: newStatus })
        .eq("id", projectId);

      if (projectError) throw projectError;
    }
    
    return newStatus;
  } catch (error) {
    console.error("Error updating project status:", error);
    throw error;
  }
}