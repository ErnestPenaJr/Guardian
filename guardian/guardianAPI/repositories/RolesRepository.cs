using Models;

namespace Repositories
{
    public class RolesRepository
    {
        public List<RoleData> GetRoles()
        {
            return
            [
                new () { RoleId = 1, RoleName = "External User" },
                new() { RoleId = 2, RoleName = "General User" },
                new () { RoleId = 3, RoleName = "Processor" },
                new () { RoleId = 4, RoleName = "Manager" },
                new () { RoleId = 5, RoleName = "Administrator" }
            ];
        }
    }
}