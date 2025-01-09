


// • Submission   • Start   • Assign  
// • Complete   • Cancel   • Deny   • Approve   • Attachment Added   • Tasks     ◦ Add Task     ◦ Assign Task     
// ◦ Complete Task     ◦ Cancel Task  

namespace Handlers
{
    public static class MilestoneHandler
    {
        public static RouteGroupBuilder MapMilestoneApi(this RouteGroupBuilder group)
        {
            group.MapGet("/milestones", () => "Hello World!");
            
            return group;
        }
    }
}