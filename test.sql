-- We will simulate if we can create such a function
create table if not exists test_table (id int);

create or replace function test_trigger_func() returns trigger as $$
begin
    begin
        if NEW.nonexistent_column = true then
            null;
        end if;
    exception when others then
        null;
    end;
    return NEW;
end;
$$ language plpgsql;
