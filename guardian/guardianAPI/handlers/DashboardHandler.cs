namespace Handlers
{
    public static class DashboardHandler
    {
        public static RouteGroupBuilder MapDashboardApi(this RouteGroupBuilder group)
        {
            group.MapGet("/dashboard", () => "Hello World!");
            
            return group;
        }
    }
}