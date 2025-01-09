namespace Handlers
{
    public static class AdminHandler
    {
        public static RouteGroupBuilder MapAdminApi(this RouteGroupBuilder group)
        {
            group.MapGet("/admin", () => "Hello World!");
            
            return group;
        }
    }
}