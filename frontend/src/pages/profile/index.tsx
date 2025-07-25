import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { useUpdateProfile } from "../../hooks/useAuth";
import { useAuthStore } from "../../store/useAuthStore";
import { toast } from "sonner";

const updateFormSchema = z.object({
  firstname: z.string().optional(),
  lastname: z.string().optional(),
});

function ProfilePage() {
  const token = useAuthStore((state) => state.token);
  const { updateProfile } = useAuthStore();
  const user = useAuthStore((state) => state.user);

  const updtaeForm = useForm<z.infer<typeof updateFormSchema>>({
    resolver: zodResolver(updateFormSchema),
    defaultValues: {
      firstname: user?.profile.firstname,
      lastname: user?.profile.lastname,
    },
  });

  const { mutateAsync: updatedProfile, isPending: updateProfilePending } =
    useUpdateProfile(token);

  const handleUpdateSubmit = async (
    values: z.infer<typeof updateFormSchema>
  ) => {
    try {
      await updatedProfile(
        { firstname: values.firstname, lastname: values.lastname },
        {
          onSuccess: (response) => {
            const res = response.data;
            updateProfile({ profile: res.data });
            toast.success(res.message);
          },
        }
      );
    } catch (error) {}
  };

  return (
    <div className="w-full mt-3">
      <Card className="mx-6">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your profile</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <Form {...updtaeForm}>
            <form
              onSubmit={updtaeForm.handleSubmit(handleUpdateSubmit)}
              className="flex flex-col gap-6"
            >
              <FormField
                control={updtaeForm.control}
                name="firstname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Firstname</FormLabel>
                    <FormControl>
                      <Input
                        id="firstname"
                        type="firstname"
                        placeholder="Firstname"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={updtaeForm.control}
                name="lastname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lastname</FormLabel>
                    <FormControl>
                      <Input
                        id="lastname"
                        type="lastname"
                        placeholder="Lastname"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                disabled={updateProfilePending}
                type="submit"
                className="w-full"
              >
                Update
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter></CardFooter>
      </Card>
    </div>
  );
}

export default ProfilePage;
