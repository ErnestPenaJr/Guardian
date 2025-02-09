using Database.Entities;
using Models;

namespace Repositories
{
    public class MilestoneRepository(GuardianDb db)
    {
        public List<MilestoneData> GetMilestoneTypes()
        {
            return
            [
                new () { MilestoneId = 1, Name = "Submission" },
                new() { MilestoneId = 2, Name = "Start" },
                new () { MilestoneId = 3, Name = "Assign" },
                new () { MilestoneId = 4, Name = "Complete" },
                new () { MilestoneId = 5, Name = "Cancel" },
                new () { MilestoneId = 6, Name = "Deny" },
                new () { MilestoneId = 7, Name = "Approve" },
                new () { MilestoneId = 8, Name = "Attachment Added" },
                new () { MilestoneId = 9, Name = "Add Task" },
                new () { MilestoneId = 10, Name = "Assign Task" },
                new () { MilestoneId = 11, Name = "Complete Task" },
                new () { MilestoneId = 12, Name = "Cancel Task" }
            ];
        }

    }
}