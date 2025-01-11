



using Repositories;

namespace Handlers
{
    public static class MilestoneHandler
    {
        public static RouteGroupBuilder MapMilestoneApi(this RouteGroupBuilder group)
        {
            group.MapGet("/milestones", (MilestoneRepository msRepo) => msRepo.GetMilestoneTypes());
            
            return group;
        }
    }
}