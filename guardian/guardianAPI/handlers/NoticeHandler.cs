namespace Handlers
{
    public static class NoticeHandler
    {
        public static RouteGroupBuilder MapNoticeApi(this RouteGroupBuilder group)
        {
            group.MapGet("/notice", () => "Hello World!");
            
            return group;
        }
    }
}