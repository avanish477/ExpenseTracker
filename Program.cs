using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add Database Context with SQLite
builder.Services.AddDbContext<ExpenseDbContext>(options =>
    options.UseSqlite("Data Source=expenses.db"));

// Configure Cookie Authentication
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "SmartExpenseTracker.Auth";
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// Enable serving static files (HTML, CSS, JS) from wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

// Enable Authentication and Authorization
app.UseAuthentication();
app.UseAuthorization();

// Automatically create database schema if it doesn't exist
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ExpenseDbContext>();
    dbContext.Database.EnsureCreated();
}

// --- AUTHENTICATION API ENDPOINTS ---

// POST: /api/auth/register - Register a new user
app.MapPost("/api/auth/register", async (RegisterRequest req, ExpenseDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
        return Results.BadRequest("Username and password are required.");

    var existingUser = await db.Users.AnyAsync(u => u.Username.ToLower() == req.Username.ToLower());
    if (existingUser)
        return Results.BadRequest("Username is already taken.");

    var (hash, salt) = PasswordHasher.HashPassword(req.Password);
    var user = new User
    {
        Username = req.Username,
        PasswordHash = hash,
        Salt = salt
    };

    db.Users.Add(user);
    await db.SaveChangesAsync();

    // Auto-seed default categories for this user
    var defaultCategories = new List<Category>
    {
        new() { Name = "Food", Color = "#f59e0b", UserId = user.Id },
        new() { Name = "Shopping", Color = "#3b82f6", UserId = user.Id },
        new() { Name = "Housing", Color = "#8b5cf6", UserId = user.Id },
        new() { Name = "Entertainment", Color = "#ec4899", UserId = user.Id },
        new() { Name = "Salary", Color = "#10b981", UserId = user.Id },
        new() { Name = "Investments", Color = "#06b6d4", UserId = user.Id },
        new() { Name = "Other", Color = "#6b7280", UserId = user.Id }
    };
    db.Categories.AddRange(defaultCategories);
    await db.SaveChangesAsync();

    return Results.Ok(new { message = "User registered successfully." });
});

// POST: /api/auth/login - Log in a user and issue cookie
app.MapPost("/api/auth/login", async (LoginRequest req, ExpenseDbContext db, HttpContext httpContext) =>
{
    if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
        return Results.BadRequest("Username and password are required.");

    var user = await db.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == req.Username.ToLower());
    if (user == null || !PasswordHasher.VerifyPassword(req.Password, user.PasswordHash, user.Salt))
        return Results.BadRequest("Invalid username or password.");

    var claims = new List<Claim> { new Claim(ClaimTypes.Name, user.Username) };
    var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);

    await httpContext.SignInAsync(
        CookieAuthenticationDefaults.AuthenticationScheme, 
        new ClaimsPrincipal(claimsIdentity),
        new AuthenticationProperties { IsPersistent = true });

    return Results.Ok(new { message = "Logged in successfully.", username = user.Username });
});

// POST: /api/auth/logout - Log out a user
app.MapPost("/api/auth/logout", async (HttpContext httpContext) =>
{
    await httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.Ok(new { message = "Logged out successfully." });
});

// GET: /api/auth/me - Get current logged-in user profile
app.MapGet("/api/auth/me", (HttpContext httpContext) =>
{
    if (httpContext.User.Identity?.IsAuthenticated == true)
    {
        return Results.Ok(new { username = httpContext.User.Identity.Name });
    }
    return Results.Unauthorized();
});

// POST: /api/auth/change-password - Change password for logged-in user
app.MapPost("/api/auth/change-password", async (ChangePasswordRequest req, ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(req.OldPassword) || string.IsNullOrWhiteSpace(req.NewPassword))
        return Results.BadRequest("Old and new passwords are required.");

    if (!PasswordHasher.VerifyPassword(req.OldPassword, user.PasswordHash, user.Salt))
        return Results.BadRequest("Incorrect current password.");

    // Update password hash and salt
    var (hash, salt) = PasswordHasher.HashPassword(req.NewPassword);
    user.PasswordHash = hash;
    user.Salt = salt;

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Password updated successfully." });
});

// --- EXPENSES API ENDPOINTS (SECURED) ---
var expenseGroup = app.MapGroup("/api/expenses").RequireAuthorization();

// GET: /api/expenses - Get all transactions for the logged-in user
expenseGroup.MapGet("/", async (ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    var userExpenses = await db.Expenses
        .Where(e => e.UserId == user.Id)
        .OrderByDescending(e => e.Date)
        .ToListAsync();

    return Results.Ok(userExpenses);
});

// GET: /api/expenses/{id} - Get a single transaction belonging to current user
expenseGroup.MapGet("/{id:int}", async (int id, ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    var expense = await db.Expenses.FindAsync(id);
    if (expense == null || expense.UserId != user.Id) 
        return Results.NotFound();

    return Results.Ok(expense);
});

// POST: /api/expenses - Add a new transaction for current user
expenseGroup.MapPost("/", async (Expense expense, ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(expense.Description))
        return Results.BadRequest("Description is required.");
    if (expense.Amount <= 0)
        return Results.BadRequest("Amount must be greater than zero.");
    if (string.IsNullOrWhiteSpace(expense.Category))
        return Results.BadRequest("Category is required.");
    
    if (expense.Type != "Income" && expense.Type != "Expense")
        expense.Type = "Expense";

    if (expense.Date == default)
        expense.Date = DateTime.Now;

    expense.UserId = user.Id; // Assign to logged-in user
    db.Expenses.Add(expense);
    await db.SaveChangesAsync();

    return Results.Created($"/api/expenses/{expense.Id}", expense);
});

// PUT: /api/expenses/{id} - Update an existing transaction for current user
expenseGroup.MapPut("/{id:int}", async (int id, Expense updatedExpense, ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    var expense = await db.Expenses.FindAsync(id);
    if (expense == null || expense.UserId != user.Id) 
        return Results.NotFound();

    if (string.IsNullOrWhiteSpace(updatedExpense.Description))
        return Results.BadRequest("Description is required.");
    if (updatedExpense.Amount <= 0)
        return Results.BadRequest("Amount must be greater than zero.");
    if (string.IsNullOrWhiteSpace(updatedExpense.Category))
        return Results.BadRequest("Category is required.");
    if (updatedExpense.Type != "Income" && updatedExpense.Type != "Expense")
        updatedExpense.Type = "Expense";

    expense.Description = updatedExpense.Description;
    expense.Amount = updatedExpense.Amount;
    expense.Category = updatedExpense.Category;
    expense.Date = updatedExpense.Date;
    expense.Type = updatedExpense.Type;

    await db.SaveChangesAsync();
    return Results.NoContent();
});

// DELETE: /api/expenses/{id} - Delete a transaction belonging to current user
expenseGroup.MapDelete("/{id:int}", async (int id, ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    var expense = await db.Expenses.FindAsync(id);
    if (expense == null || expense.UserId != user.Id) 
        return Results.NotFound();

    db.Expenses.Remove(expense);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// GET: /api/expenses/summary - Get user-specific aggregated summary
expenseGroup.MapGet("/summary", async (ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    var items = await db.Expenses
        .Where(e => e.UserId == user.Id)
        .ToListAsync();
    
    var totalIncome = items.Where(i => i.Type == "Income").Sum(i => i.Amount);
    var totalExpense = items.Where(i => i.Type == "Expense").Sum(i => i.Amount);
    var totalBalance = totalIncome - totalExpense;

    var categoryBreakdown = items
        .Where(i => i.Type == "Expense")
        .GroupBy(i => i.Category)
        .ToDictionary(g => g.Key, g => g.Sum(i => i.Amount));

    return Results.Ok(new
    {
        TotalBalance = totalBalance,
        TotalIncome = totalIncome,
        TotalExpense = totalExpense,
        CategoryBreakdown = categoryBreakdown
    });
});

// --- BUDGET API ENDPOINTS (SECURED) ---
var budgetGroup = app.MapGroup("/api/budgets").RequireAuthorization();

// GET: /api/budgets - Get user's budgeting limits
budgetGroup.MapGet("/", async (ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    var userBudgets = await db.Budgets.Where(b => b.UserId == user.Id).ToListAsync();
    return Results.Ok(userBudgets);
});

// POST: /api/budgets - Set or update budget limit for a category
budgetGroup.MapPost("/", async (BudgetRequest req, ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(req.Category))
        return Results.BadRequest("Category is required.");
    if (req.LimitAmount < 0)
        return Results.BadRequest("Limit amount cannot be negative.");

    var budget = await db.Budgets.FirstOrDefaultAsync(b => b.UserId == user.Id && b.Category == req.Category);
    if (budget == null)
    {
        budget = new Budget
        {
            Category = req.Category,
            LimitAmount = req.LimitAmount,
            UserId = user.Id
        };
        db.Budgets.Add(budget);
    }
    else
    {
        budget.LimitAmount = req.LimitAmount;
    }

    await db.SaveChangesAsync();
    return Results.Ok(budget);
});

// --- REMINDERS API ENDPOINTS (SECURED) ---
var remindersGroup = app.MapGroup("/api/reminders").RequireAuthorization();

// GET: /api/reminders - Get unpaid reminders for the logged-in user
remindersGroup.MapGet("/", async (ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    var unpaidReminders = await db.BillReminders
        .Where(r => r.UserId == user.Id && !r.IsPaid)
        .OrderBy(r => r.DueDate)
        .ToListAsync();

    return Results.Ok(unpaidReminders);
});

// POST: /api/reminders - Create a new reminder
remindersGroup.MapPost("/", async (ReminderRequest req, ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(req.Title))
        return Results.BadRequest("Title is required.");
    if (req.Amount <= 0)
        return Results.BadRequest("Amount must be greater than zero.");
    if (string.IsNullOrWhiteSpace(req.Category))
        return Results.BadRequest("Category is required.");

    var reminder = new BillReminder
    {
        Title = req.Title,
        Amount = req.Amount,
        DueDate = req.DueDate == default ? DateTime.Now.AddDays(7) : req.DueDate,
        Category = req.Category,
        IsPaid = false,
        UserId = user.Id
    };

    db.BillReminders.Add(reminder);
    await db.SaveChangesAsync();

    return Results.Created($"/api/reminders/{reminder.Id}", reminder);
});

// POST: /api/reminders/{id}/pay - Mark reminder as paid and automatically insert Expense
remindersGroup.MapPost("/{id:int}/pay", async (int id, ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    var reminder = await db.BillReminders.FindAsync(id);
    if (reminder == null || reminder.UserId != user.Id)
        return Results.NotFound();

    if (reminder.IsPaid)
        return Results.BadRequest("Reminder is already paid.");

    // Mark as paid
    reminder.IsPaid = true;

    // Auto-create a corresponding Expense transaction
    var expense = new Expense
    {
        Description = $"[Paid Bill] {reminder.Title}",
        Amount = reminder.Amount,
        Category = reminder.Category,
        Date = DateTime.Now,
        Type = "Expense",
        UserId = user.Id
    };

    db.Expenses.Add(expense);
    await db.SaveChangesAsync();

    return Results.Ok(new { message = "Bill marked as paid and logged as expense.", expense });
});

// DELETE: /api/reminders/{id} - Delete a reminder
remindersGroup.MapDelete("/{id:int}", async (int id, ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    var reminder = await db.BillReminders.FindAsync(id);
    if (reminder == null || reminder.UserId != user.Id)
        return Results.NotFound();

    db.BillReminders.Remove(reminder);
    await db.SaveChangesAsync();

    return Results.NoContent();
});

// --- CATEGORIES API ENDPOINTS (SECURED) ---
var categoriesGroup = app.MapGroup("/api/categories").RequireAuthorization();

// GET: /api/categories - Get all custom categories for user
categoriesGroup.MapGet("/", async (ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    var userCategories = await db.Categories.Where(c => c.UserId == user.Id).ToListAsync();
    return Results.Ok(userCategories);
});

// POST: /api/categories - Create a custom category
categoriesGroup.MapPost("/", async (CategoryRequest req, ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(req.Name))
        return Results.BadRequest("Category name is required.");

    var normalized = req.Name.Trim();
    var exists = await db.Categories.AnyAsync(c => c.UserId == user.Id && c.Name.ToLower() == normalized.ToLower());
    if (exists)
        return Results.BadRequest("Category already exists.");

    var category = new Category
    {
        Name = normalized,
        Color = string.IsNullOrWhiteSpace(req.Color) ? "#6b7280" : req.Color,
        UserId = user.Id
    };

    db.Categories.Add(category);
    await db.SaveChangesAsync();

    return Results.Created($"/api/categories/{category.Id}", category);
});

// DELETE: /api/categories/{id} - Delete custom category safely
categoriesGroup.MapDelete("/{id:int}", async (int id, ClaimsPrincipal userPrincipal, ExpenseDbContext db) =>
{
    var username = userPrincipal.Identity?.Name;
    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user == null) return Results.Unauthorized();

    var category = await db.Categories.FindAsync(id);
    if (category == null || category.UserId != user.Id)
        return Results.NotFound();

    // Prevent removing everything to avoid visual break
    var count = await db.Categories.CountAsync(c => c.UserId == user.Id);
    if (count <= 1)
        return Results.BadRequest("You must keep at least one category.");

    // Update transactions using this category to "Other"
    var transactionsUsingCat = await db.Expenses.Where(e => e.UserId == user.Id && e.Category == category.Name).ToListAsync();
    foreach (var t in transactionsUsingCat)
    {
        t.Category = "Other";
    }

    // Remove budgets using this category
    var budgetsUsingCat = await db.Budgets.Where(b => b.UserId == user.Id && b.Category == category.Name).ToListAsync();
    db.Budgets.RemoveRange(budgetsUsingCat);

    // Update reminders using this category to "Other"
    var remindersUsingCat = await db.BillReminders.Where(r => r.UserId == user.Id && r.Category == category.Name).ToListAsync();
    foreach (var r in remindersUsingCat)
    {
        r.Category = "Other";
    }

    db.Categories.Remove(category);
    await db.SaveChangesAsync();

    return Results.NoContent();
});

app.Run();

// --- DATA MODELS ---

public class Expense
{
    public int Id { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Category { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string Type { get; set; } = "Expense"; // "Income" or "Expense"
    public int UserId { get; set; } // Foreign key to User
}

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Salt { get; set; } = string.Empty;
}

public class Budget
{
    public int Id { get; set; }
    public string Category { get; set; } = string.Empty;
    public decimal LimitAmount { get; set; }
    public int UserId { get; set; } // Foreign key to User
}

public class BillReminder
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime DueDate { get; set; }
    public string Category { get; set; } = string.Empty;
    public bool IsPaid { get; set; }
    public int UserId { get; set; } // Foreign key to User
}

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#6b7280";
    public int UserId { get; set; } // Foreign key to User
}

public class ExpenseDbContext : DbContext
{
    public ExpenseDbContext(DbContextOptions<ExpenseDbContext> options) : base(options) { }
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Budget> Budgets => Set<Budget>();
    public DbSet<BillReminder> BillReminders => Set<BillReminder>();
    public DbSet<Category> Categories => Set<Category>();
}

// --- DATA RECORDS ---

public record RegisterRequest(string Username, string Password);
public record LoginRequest(string Username, string Password);
public record BudgetRequest(string Category, decimal LimitAmount);
public record ReminderRequest(string Title, decimal Amount, DateTime DueDate, string Category);
public record CategoryRequest(string Name, string Color);
public record ChangePasswordRequest(string OldPassword, string NewPassword);

// --- PASSWORD HASHER HELPER ---

public static class PasswordHasher
{
    public static (string hash, string salt) HashPassword(string password)
    {
        var saltBytes = RandomNumberGenerator.GetBytes(16);
        var salt = Convert.ToBase64String(saltBytes);
        
        using var sha256 = SHA256.Create();
        var saltedPassword = password + salt;
        var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(saltedPassword));
        var hash = Convert.ToBase64String(hashBytes);
        
        return (hash, salt);
    }

    public static bool VerifyPassword(string password, string hash, string salt)
    {
        using var sha256 = SHA256.Create();
        var saltedPassword = password + salt;
        var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(saltedPassword));
        var computedHash = Convert.ToBase64String(hashBytes);
        return computedHash == hash;
    }
}
