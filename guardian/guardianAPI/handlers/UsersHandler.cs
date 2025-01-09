


//name, organization, email, active, roleId, 

namespace Handlers
{
    public static class UsersHandler
    {
        public static RouteGroupBuilder MapUsersApi(this RouteGroupBuilder group)
        {
            group.MapGet("/users", () => "Hello World!");
            
            return group;
        }
    }
}