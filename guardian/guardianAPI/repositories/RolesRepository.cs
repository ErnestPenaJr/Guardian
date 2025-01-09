using Models;

namespace Repositories
{
    public class RolesRepository
    {

        // External User, General User, Processor, Manager, Administrator
        public static List<RoleData> GetRoles()
        {
            return
            [
                new () { RoleId = 1, RoleName = "Admin" },
                new() { RoleId = 2, RoleName = "User" },
                new () { RoleId = 3, RoleName = "Guest" }
            ];
        }
    }
}