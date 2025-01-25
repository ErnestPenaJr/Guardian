namespace Handlers
{
    public static class RequestHandler
    {
        public static RouteGroupBuilder MapRequestApi(this RouteGroupBuilder group)
        {
            group.MapGet("/requests/{id}", (int id) => {
                
            });

            
            return group;
        }
    }
}