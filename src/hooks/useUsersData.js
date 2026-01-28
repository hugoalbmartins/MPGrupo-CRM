import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService } from '../services/usersService';
import { toast } from 'sonner';

export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getUsers(),
    staleTime: 5 * 60 * 1000,
  });
};

export const useUser = (userId) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersService.getUser(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userData) => usersService.createUser(userData),
    onMutate: async (newUser) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const previousUsers = queryClient.getQueryData(['users']);

      queryClient.setQueryData(['users'], (old) => {
        if (!old) return [{ ...newUser, id: 'temp-' + Date.now() }];
        return [...old, { ...newUser, id: 'temp-' + Date.now() }];
      });

      return { previousUsers };
    },
    onError: (err, newUser, context) => {
      queryClient.setQueryData(['users'], context.previousUsers);
      toast.error('Erro ao criar utilizador');
    },
    onSuccess: () => {
      toast.success('Utilizador criado com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, updates }) => usersService.updateUser(userId, updates),
    onMutate: async ({ userId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['user', userId] });
      const previousUser = queryClient.getQueryData(['user', userId]);

      queryClient.setQueryData(['user', userId], (old) => ({
        ...old,
        ...updates,
      }));

      return { previousUser };
    },
    onError: (err, { userId }, context) => {
      queryClient.setQueryData(['user', userId], context.previousUser);
      toast.error('Erro ao atualizar utilizador');
    },
    onSuccess: () => {
      toast.success('Utilizador atualizado com sucesso');
    },
    onSettled: (data, error, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => usersService.deleteUser(userId),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const previousUsers = queryClient.getQueryData(['users']);

      queryClient.setQueryData(['users'], (old) =>
        old?.filter((user) => user.id !== userId)
      );

      return { previousUsers };
    },
    onError: (err, userId, context) => {
      queryClient.setQueryData(['users'], context.previousUsers);
      toast.error('Erro ao eliminar utilizador');
    },
    onSuccess: () => {
      toast.success('Utilizador eliminado com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};
