

## instal ef tooling

dotnet tool install --global dotnet-ef

## scaffold from database

dotnet ef dbcontext scaffold "Name=ConnectionStrings:DefaultConnection" Microsoft.EntityFrameworkCore.SqlServer --no-onconfiguring --schema GUARDIAN --namespace Database.Guardian.Entities --output-dir database/guardian/entities --context GuardianDbContext --force

