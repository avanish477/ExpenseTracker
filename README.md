# Expense Tracker

A simple and user-friendly **Expense Tracker Web Application** built with **ASP.NET Core**. The application helps users record, manage, and track their daily expenses through a web-based interface.

## 🚀 Features

* Add and manage expenses
* Track daily spending
* Store expense data using SQLite
* Responsive web interface
* ASP.NET Core backend
* Simple and easy-to-use design
* Local database support
* Development configuration support

## 🛠️ Technologies Used

* **C#**
* **ASP.NET Core**
* **.NET**
* **HTML5**
* **CSS3**
* **JavaScript**
* **SQLite**
* **Entity Framework Core**

## 📂 Project Structure

```text
ExpenseTracker/
│
├── Properties/
│   └── ...
│
├── wwwroot/
│   └── Static files
│
├── Program.cs
├── ExpenseTracker.csproj
├── ExpenseTracker.slnx
│
├── appsettings.json
├── appsettings.Development.json
│
├── expenses.db
├── expenses.db-shm
├── expenses.db-wal
│
├── .gitignore
├── .gitattributes
└── README.md
```

## ⚙️ Prerequisites

Before running the project, make sure you have:

* Visual Studio 2022 or later
* .NET SDK compatible with the project
* A modern web browser
* Git (optional, for GitHub)

## ▶️ How to Run

### Using Visual Studio

1. Clone or download this repository.
2. Open `ExpenseTracker.slnx` in Visual Studio.
3. Wait for dependencies/NuGet packages to restore.
4. Set `ExpenseTracker` as the startup project.
5. Press **F5** or click the **Run** button.
6. The application will open in your default browser.

### Using Command Line

Navigate to the project directory:

```bash
cd ExpenseTracker
```

Restore dependencies:

```bash
dotnet restore
```

Build the project:

```bash
dotnet build
```

Run the application:

```bash
dotnet run
```

Open the localhost URL shown in the terminal.

## 🗄️ Database

The project uses **SQLite** for local data storage.

The database file is:

```text
expenses.db
```

The files:

```text
expenses.db-shm
expenses.db-wal
```

are SQLite temporary/write-ahead logging files generated while the database is in use.

## 🔧 Configuration

Application configuration is stored in:

```text
appsettings.json
appsettings.Development.json
```

Update the configuration according to your local environment if required.

## 📸 Application

Add screenshots of your application here:

```text
screenshots/
├── dashboard.png
├── add-expense.png
└── expense-list.png
```

Example:

```markdown
![Expense Tracker Dashboard](screenshots/dashboard.png)
```

## 🎯 Purpose

The main purpose of this project is to provide a simple application for managing personal expenses while demonstrating practical knowledge of:

* ASP.NET Core development
* C# programming
* Database integration
* CRUD operations
* Web application development
* Application configuration

## 🔮 Future Improvements

Possible future enhancements include:

* User authentication and authorization
* Expense categories
* Monthly expense reports
* Charts and analytics
* Budget management
* Export expenses to Excel/PDF
* Cloud database integration
* Mobile-friendly improvements
* REST API integration

## 👨‍💻 Author

**Avanish Singh**

MCA – Artificial Intelligence

## 📄 License

This project is created for educational and portfolio purposes.
