
using Microsoft.EntityFrameworkCore;

namespace Database.Entities {

    public class GuardianDb: DbContext {

        public GuardianDb(DbContextOptions<GuardianDb> options): base(options) {}

        // public DbSet<MilestoneTypes> MilestoneTypes {get; set;}
    }

}