//User Status: Invited, Pending, Denied, Active, Inactive


using Models;

namespace Repositories
{
    public class UserRepository
    {
        public List<UserStatus> GetStatusTypes()
        {
            return
            [
                new () { StatusId = 1, StatusName = "Invited" },
                new() { StatusId = 2, StatusName = "Pending" },
                new () { StatusId = 3, StatusName = "Denied" },
                new () { StatusId = 4, StatusName = "Active" },
                new () { StatusId = 5, StatusName = "Inactive" }
            ];
        }
    }
}