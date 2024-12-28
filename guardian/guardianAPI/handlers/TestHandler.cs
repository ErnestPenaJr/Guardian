namespace Handlers
{
    public static class TestHandler
    {
        public static RouteGroupBuilder MapTestApi(this RouteGroupBuilder group)
        {
            group.MapGet("/test", () => "Hello World!");
            
            return group;
        }
    }
}