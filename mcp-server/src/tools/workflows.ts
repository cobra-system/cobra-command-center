import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../supabase.js";

export function registerWorkflowTools(server: McpServer) {
  server.tool(
    "create_workflow_instance",
    "הפעלת תהליך רכש — Create a workflow instance for an order based on a template",
    {
      template_id: z.string().uuid().describe("Workflow template UUID"),
      order_id: z.string().uuid().describe("Order UUID to attach the workflow to"),
      created_by: z.string().uuid().optional().describe("UUID of the user creating the workflow"),
    },
    async ({ template_id, order_id, created_by }) => {
      // Verify template exists
      const { data: template, error: templateError } = await supabase
        .from("workflow_templates")
        .select("id, name")
        .eq("id", template_id)
        .single();

      if (templateError) {
        return { content: [{ type: "text" as const, text: `Error: template not found — ${templateError.message}` }] };
      }

      const { data, error } = await supabase
        .from("workflow_instances")
        .insert({
          template_id,
          order_id,
          created_by: created_by ?? null,
          current_step: 0,
          status: "active",
        })
        .select()
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return {
        content: [{ type: "text" as const, text: `Workflow "${template.name}" created for order:\n${JSON.stringify(data, null, 2)}` }],
      };
    }
  );

  server.tool(
    "get_workflow_instance",
    "שאילתת שלב נוכחי — Get workflow instance by order ID, including template steps and completed step logs",
    {
      order_id: z.string().uuid().describe("Order UUID"),
    },
    async ({ order_id }) => {
      // Get instance(s) for this order
      const { data: instances, error: instError } = await supabase
        .from("workflow_instances")
        .select("*")
        .eq("order_id", order_id)
        .order("created_at", { ascending: false });

      if (instError) return { content: [{ type: "text" as const, text: `Error: ${instError.message}` }] };
      if (!instances || instances.length === 0) {
        return { content: [{ type: "text" as const, text: `No workflow found for order ${order_id}` }] };
      }

      const instance = instances[0];

      // Fetch template steps and step logs in parallel
      const [templateRes, logsRes] = await Promise.all([
        instance.template_id
          ? supabase.from("workflow_templates").select("*").eq("id", instance.template_id).single()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("workflow_step_logs")
          .select("*")
          .eq("instance_id", instance.id)
          .order("step_index", { ascending: true }),
      ]);

      const result = {
        ...instance,
        template: templateRes.data || null,
        step_logs: logsRes.data || [],
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_workflow_step",
    "קידום/עדכון שלב בתהליך — Advance or update a workflow step. Logs the completed step and moves to the next one.",
    {
      instance_id: z.string().uuid().describe("Workflow instance UUID"),
      step_index: z.number().describe("The step index being completed (0-based)"),
      completed_by: z.string().uuid().optional().describe("UUID of user completing the step"),
      notes: z.string().optional().describe("Notes about step completion"),
      action_data: z.record(z.unknown()).optional().describe("Arbitrary JSON data for this step"),
    },
    async ({ instance_id, step_index, completed_by, notes, action_data }) => {
      // Get instance + template to know total steps
      const { data: instance, error: instError } = await supabase
        .from("workflow_instances")
        .select("*, workflow_templates(steps)")
        .eq("id", instance_id)
        .single();

      if (instError) return { content: [{ type: "text" as const, text: `Error: ${instError.message}` }] };

      // Log the completed step
      const { error: logError } = await supabase
        .from("workflow_step_logs")
        .insert({
          instance_id,
          step_index,
          completed_by: completed_by ?? null,
          notes: notes ?? null,
          action_data: action_data ?? null,
        });

      if (logError) return { content: [{ type: "text" as const, text: `Error logging step: ${logError.message}` }] };

      // Determine if this was the last step
      const templateData = instance.workflow_templates as { steps: unknown[] } | null;
      const totalSteps = Array.isArray(templateData?.steps) ? templateData!.steps.length : 0;
      const nextStep = step_index + 1;
      const isCompleted = totalSteps > 0 && nextStep >= totalSteps;

      // Update instance
      const { data: updated, error: updateError } = await supabase
        .from("workflow_instances")
        .update({
          current_step: nextStep,
          status: isCompleted ? "completed" : "active",
        })
        .eq("id", instance_id)
        .select()
        .single();

      if (updateError) return { content: [{ type: "text" as const, text: `Step logged but instance update failed: ${updateError.message}` }] };

      return {
        content: [{
          type: "text" as const,
          text: isCompleted
            ? `Workflow completed!\n${JSON.stringify(updated, null, 2)}`
            : `Step ${step_index} completed, moved to step ${nextStep}:\n${JSON.stringify(updated, null, 2)}`,
        }],
      };
    }
  );

  server.tool(
    "list_workflow_instances",
    "רשימת תהליכים — List all workflow instances with their current step and template name",
    {
      status: z.enum(["active", "completed", "cancelled"]).optional().describe("Filter by status: active, completed, cancelled"),
      template_id: z.string().uuid().optional().describe("Filter by template UUID"),
      limit: z.number().default(50).describe("Max results"),
    },
    async ({ status, template_id, limit }) => {
      let query = supabase
        .from("workflow_instances")
        .select("*, workflow_templates(name, steps)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) query = query.eq("status", status);
      if (template_id) query = query.eq("template_id", template_id);

      const { data, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      // Enrich with step info
      const enriched = (data || []).map((inst: Record<string, unknown>) => {
        const tmpl = inst.workflow_templates as { name: string; steps: unknown[] } | null;
        return {
          ...inst,
          template_name: tmpl?.name ?? null,
          total_steps: Array.isArray(tmpl?.steps) ? tmpl!.steps.length : 0,
          workflow_templates: undefined,
        };
      });

      return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
    }
  );
}
