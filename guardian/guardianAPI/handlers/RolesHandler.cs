


// External User, General User, Processor, Manager, Administrator






//name, organization, email, active, roleId, 

using Repositories;

namespace Handlers
{
    public static class RolesHandler
    {
        public static RouteGroupBuilder MapRolesApi(this RouteGroupBuilder group)
        {
            group.MapGet("/roles", (RolesRepository rolesRepo) => rolesRepo.GetRoles());
            
            return group;
        }
    }
}