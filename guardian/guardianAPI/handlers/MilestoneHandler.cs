



using Repositories;

namespace Handlers
{
    public static class MilestoneHandler
    {
        public static RouteGroupBuilder MapMilestoneApi(this RouteGroupBuilder group)
        {
            group.MapGet("/milestones", async (MilestoneRepository msRepo) => await msRepo.GetMilestoneTypes());
            
            return group;
        }
    }
}