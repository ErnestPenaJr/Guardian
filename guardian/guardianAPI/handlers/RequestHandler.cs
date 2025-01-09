namespace Handlers
{
    public static class RequestHandler
    {
        public static RouteGroupBuilder MapRequestApi(this RouteGroupBuilder group)
        {
            group.MapGet("/request", () => "Hello World!");
            
            return group;
        }
    }
}