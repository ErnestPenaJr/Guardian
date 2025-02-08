//User Status: Invited, Pending, Denied, Active, Inactive


using Models;

namespace Repositories
{
    public class WorkflowRepository
    {

    // public record WorkflowData {

    //     public required int WorkflowId {get;init;}

    //     public required string Name {get;init;}

    //     public required string Description {get;init;}

    //     public required bool Active {get;init;}

    //     public required bool External {get;init;}

    //     public required bool SelfService {get;init;} = false;

    //     public required string WorkflowType {get;init;}

    //     public required string CustomWorkflow {get;init;} //represent the json
    // }
        public WorkflowData? GetWorkflow(int workflowId)
        {
            return workflowId switch
            {
                1 => new WorkflowData { WorkflowId = 1, Name = "User Workflow", Description = "User Workflow Description", Active = true, External = false, SelfService = false, WorkflowType = "User", CustomWorkflow = "User Workflow JSON" },
                2 => new WorkflowData { WorkflowId = 2, Name = "Request Workflow", Description = "Request Workflow Description", Active = true, External = false, SelfService = false, WorkflowType = "Request", CustomWorkflow = "Request Workflow JSON" },
                3 => new WorkflowData { WorkflowId = 3, Name = "Milestone Workflow", Description = "Milestone Workflow Description", Active = true, External = false, SelfService = false, WorkflowType = "Milestone", CustomWorkflow = "Milestone Workflow JSON" },
                _ => null
            };
        }

        public List<WorkflowData> GetWorkflows(string workflowType = "all")
        {
            return workflowType switch
            {
                "all" => new List<WorkflowData>
                {
                    new WorkflowData { WorkflowId = 1, Name = "User Workflow", Description = "User Workflow Description", Active = true, External = false, SelfService = false, WorkflowType = "User", CustomWorkflow = "User Workflow JSON" },
                    new WorkflowData { WorkflowId = 2, Name = "Request Workflow", Description = "Request Workflow Description", Active = true, External = false, SelfService = false, WorkflowType = "Request", CustomWorkflow = "Request Workflow JSON" },
                    new WorkflowData { WorkflowId = 3, Name = "Milestone Workflow", Description = "Milestone Workflow Description", Active = true, External = false, SelfService = false, WorkflowType = "Milestone", CustomWorkflow = "Milestone Workflow JSON" }
                },
                "User" => new List<WorkflowData>
                {
                    new WorkflowData { WorkflowId = 1, Name = "User Workflow", Description = "User Workflow Description", Active = true, External = false, SelfService = false, WorkflowType = "User", CustomWorkflow = "User Workflow JSON" }
                },
                "Request" => new List<WorkflowData>
                {
                    new WorkflowData { WorkflowId = 2, Name = "Request Workflow", Description = "Request Workflow Description", Active = true, External = false, SelfService = false, WorkflowType = "Request", CustomWorkflow = "Request Workflow JSON" }
                },
                "Milestone" => new List<WorkflowData>
                {
                    new WorkflowData { WorkflowId = 3, Name = "Milestone Workflow", Description = "Milestone Workflow Description", Active = true, External = false, SelfService = false, WorkflowType = "Milestone", CustomWorkflow = "Milestone Workflow JSON" }
                },
                _ => new List<WorkflowData>()
            };
        }

        public WorkflowData CreateWorkflow(WorkflowData workflow)
        {
            return workflow with { WorkflowId = 4 };
        }

        public WorkflowData UpdateWorkflow(WorkflowData workflow)
        {
            return workflow;
        }


    }
}