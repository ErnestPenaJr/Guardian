using Models;

namespace Repositories
{
    public class MilestoneRepository
    {

        // External User, General User, Processor, Manager, Administrator
        public static List<MilestoneData> GetMilestones()
        {
            return
            [
                new () { MilestoneId = 1, Name = "Milestone 1" },
                new() { MilestoneId = 2, Name = "Milestone 2" },
                new () { MilestoneId = 3, Name = "Milestone 3" }
            ];
        }
    }
}