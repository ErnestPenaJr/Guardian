using Database.Entities;
using Database.Guardian.Entities;
using Microsoft.EntityFrameworkCore;
using Models;

namespace Repositories
{
    public class MilestoneRepository(GuardianDbContext db)
    {
        public async Task<List<MilestoneData>> GetMilestoneTypes()
        {

            //TODO add to caching
            return await db.MilestoneTypes.Select(m => new MilestoneData
            {
                MilestoneId = m.Id,
                Name = m.Name
            }).ToListAsync();


        }

    }
}