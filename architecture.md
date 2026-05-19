# Architecture Documentation

## Overview

This project is a full stack Health Savings Account simulation platform that allows users to:
- Create HSA accounts
- Deposit funds
- Issue virtual debit cards
- Simulate purchases and transaction processing


## High-Level System Architecture
The application consists of the following components:
- A frontend web UI for interacting with the system
- A FastAPI backend that exposes REST API endpoints
- A relational database accessed through SQLAlchemy ORM


## Request Flow

### Create Account
User submits name and email in the given boxes on the website. 
Backend validates the request and populates the database with the account information and a balance of 0. 
Account data is returned to be displayed in the front end.

### Deposit Funds
User submits deposit amount in the given box on the website.
Backend starts a database transaction to increase the account balance.
A transaction record is created and displayed.
Account data with updated balance is returned to the front end.

### Issue Virtual Debit Card
User selects an account on the sidebar.
Backend verifies account exists by querying the database.
User presses “Issue Card” button.
Virtual debit card is generated and linked to the account.

### Process Purchase
User submits amount and merchant category.
Backend validates whether the category is a qualified medical expense, locking the account row during processing to prevent concurrent transactions from overdrafting.
If funds are sufficient, the purchase is approved. A transaction record is created and displayed, and the balance is reduced.
Otherwise, transaction is declined.


## Data Model

### Account class
Stores HSA account information. Fields are: id, owner_name, email, balance in cents, and when it was created.

### Card
Stores virtual debit card information. Fields are: id, account_id, last four digits, boolean flag for is_active, and when it was issued.

### Transaction
Represents deposits and purchases. Fields are: id, account_id, transaction_type [deposit, purchase], amount of the transaction in cents, merchant_category, status, decline_reason, and when it was created.


## Concurrency Handling

The main concurrency risk, as identified in the Take Home Assignment, is simultaneous purchases overdrafting the same account. The given example is as follows:

```text
Balance: $100

Purchase A: $80
Purchase B: $50
```

Without protection, both transactions could read the same balance before updates occur, leading to a negative account balance of -$30. To prevent this, deposits and purchases run inside database transactions using:

```python
async with db.begin():
```

and the account row is locked using:

```python
.with_for_update()
```

This locking of the database row ensures that only one transaction can modify the account balance at a time, preventing concurrency issues and negative balances.


## Design Tradeoffs

### Qualified Expense Rules

The system uses a fixed list of merchant categories to determine whether a purchase is qualified. For example, pharmacy and hospital purchases are hard-coded to be valid, while restaurant and electronics purchases are hard-coded to be invalid. This makes transaction decisions clear and easy to test, suitable for the purposes of this demo. The tradeoff is that real HSA eligibility rules are more complex than a fixed list. I considered integrating an LLM as a decisionmaker of a qualified expense; while this could be a worthwhile implementation for a production-level HSA Platform, it was deemed unnecessary for the demo.

### Account Information and Authentication

The account model stores only the information specified in the Take Home Assignment for the simulation: owner name, email, balance, and creation time. This keeps account creation simple while still supporting unique account lookup and balance tracking. A real HSA platform would require additional identity and eligibility information. 

Furthermore, authentication such as password systems was omitted to keep the project focused on transaction processing and system correctness.

### Deposit Database Storage

Deposits are stored as transactions instead of a separate deposit table. This keeps all money movement in one transaction history, enabling faster lookups and simpler processing. The tradeoff is that purchase-specific fields, like merchant_category, are empty for deposits.

### SQLite for Simplicity

SQLite was used because it is lightweight, easy to run locally, and designed for smaller local apps as it stores all database information in one file (hsa.db). This design choice traded off with PostgreSQL, a full database server, which would be a stronger choice for production-level design because it scales properly to many users and many simultaneous requests. PostgreSQL would result in stronger concurrency, reliability, and scalability, but for the purposes of this demo, SQLite was sufficient.