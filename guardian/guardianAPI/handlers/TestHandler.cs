namespace Handlers
{
    public static class TestHandler
    {
        public static RouteGroupBuilder MapTestApi(this RouteGroupBuilder group)
        {
            group.MapGet("/test", () => $"test page ${DateTime.Now}");
            
            return group;
        }
    }
}