


// External User, General User, Processor, Manager, Administrator






//name, organization, email, active, roleId, 

namespace Handlers
{
    public static class RolesHandler
    {
        public static RouteGroupBuilder MapRolesApi(this RouteGroupBuilder group)
        {
            group.MapGet("/roles", () => "Hello World!");
            
            return group;
        }
    }
}