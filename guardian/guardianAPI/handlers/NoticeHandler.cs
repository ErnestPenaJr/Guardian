namespace Handlers
{
    public static class NoticeHandler
    {
        public static RouteGroupBuilder MapNoticeApi(this RouteGroupBuilder group)
        {
            group.MapGet("/notices/{id}", (int id) => {
                
            });
            
            return group;
        }
    }
}