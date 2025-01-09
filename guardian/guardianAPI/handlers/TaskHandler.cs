




//name, organization, email, active, roleId, 

namespace Handlers
{
    public static class TaskHandler
    {
        public static RouteGroupBuilder MapTaskApi(this RouteGroupBuilder group)
        {
            group.MapGet("/task", () => "Hello World!");
            
            return group;
        }
    }
}