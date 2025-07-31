-- Fix function search path security issues
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_inventory_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update stock levels
  INSERT INTO public.stock_levels (product_id, quantity_on_hand)
  VALUES (NEW.product_id, NEW.quantity_change)
  ON CONFLICT (product_id)
  DO UPDATE SET
    quantity_on_hand = stock_levels.quantity_on_hand + NEW.quantity_change,
    last_updated = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;